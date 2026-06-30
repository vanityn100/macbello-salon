CREATE OR REPLACE FUNCTION create_invoice_with_inventory(
    p_invoice JSONB,
    p_items JSONB,
    p_retail_deductions JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_invoice_id UUID;
    v_retail JSONB;
    v_item JSONB;
BEGIN
    -- 1. Insert Invoice
    INSERT INTO invoices (
        invoice_number, customer_id, branch, subtotal, service_tax, retail_tax, total_tax, discount,
        grand_total, payment_method, points_earned, points_redeemed, status, created_at, created_by
    ) VALUES (
        p_invoice->>'invoice_number', 
        (p_invoice->>'customer_id')::UUID, 
        p_invoice->>'branch', 
        (p_invoice->>'subtotal')::NUMERIC, 
        COALESCE((p_invoice->>'service_tax')::NUMERIC, 0), 
        COALESCE((p_invoice->>'retail_tax')::NUMERIC, 0), 
        COALESCE((p_invoice->>'total_tax')::NUMERIC, 0), 
        COALESCE((p_invoice->>'discount')::NUMERIC, 0),
        COALESCE((p_invoice->>'grand_total')::NUMERIC, 0), 
        p_invoice->>'payment_method', 
        COALESCE((p_invoice->>'points_earned')::INTEGER, 0), 
        COALESCE((p_invoice->>'points_redeemed')::INTEGER, 0), 
        p_invoice->>'status',
        COALESCE((p_invoice->>'created_at')::TIMESTAMPTZ, NOW()),
        p_invoice->>'created_by'
    ) RETURNING id INTO new_invoice_id;

    -- 2. Deduct Inventory for Retail Items
    FOR v_retail IN SELECT * FROM jsonb_array_elements(p_retail_deductions) LOOP
        -- Check stock
        IF NOT EXISTS (
            SELECT 1 FROM branch_inventory 
            WHERE branch = p_invoice->>'branch' 
            AND service_id = (v_retail->>'product_id')::UUID 
            AND current_stock >= (v_retail->>'quantity')::INTEGER
        ) THEN
            RAISE EXCEPTION 'Insufficient stock for product: %', v_retail->>'item_name';
        END IF;

        UPDATE branch_inventory 
        SET current_stock = current_stock - (v_retail->>'quantity')::INTEGER
        WHERE branch = p_invoice->>'branch' AND service_id = (v_retail->>'product_id')::UUID;
        
        INSERT INTO inventory_transactions (
            product_id, transaction_type, quantity, branch, invoice_id, notes, created_by
        ) VALUES (
            (v_retail->>'product_id')::UUID, 'STOCK_OUT', (v_retail->>'quantity')::INTEGER, p_invoice->>'branch', new_invoice_id, 'Invoice Creation', p_invoice->>'created_by'
        );
    END LOOP;

    -- 3. Apply Loyalty Points (Using the correct 'transactions' table)
    IF (p_invoice->>'points_redeemed')::INTEGER > 0 THEN
        UPDATE customers 
        SET points = COALESCE(points, 0) - (p_invoice->>'points_redeemed')::INTEGER 
        WHERE id = (p_invoice->>'customer_id')::UUID;

        INSERT INTO transactions (customer_id, transaction_type, points_change, notes, branch, created_by_email, balance_after)
        VALUES (
            (p_invoice->>'customer_id')::UUID, 
            'redeem', 
            -(p_invoice->>'points_redeemed')::INTEGER, 
            'Points redeemed on invoice creation ' || (p_invoice->>'invoice_number'), 
            p_invoice->>'branch', 
            p_invoice->>'created_by',
            (SELECT COALESCE(points, 0) FROM customers WHERE id = (p_invoice->>'customer_id')::UUID)
        );
    END IF;

    IF (p_invoice->>'points_earned')::INTEGER > 0 THEN
        UPDATE customers 
        SET points = COALESCE(points, 0) + (p_invoice->>'points_earned')::INTEGER 
        WHERE id = (p_invoice->>'customer_id')::UUID;

        INSERT INTO transactions (customer_id, transaction_type, points_change, notes, branch, created_by_email, balance_after)
        VALUES (
            (p_invoice->>'customer_id')::UUID, 
            'add', 
            (p_invoice->>'points_earned')::INTEGER, 
            'Points earned on invoice creation ' || (p_invoice->>'invoice_number'), 
            p_invoice->>'branch', 
            p_invoice->>'created_by',
            (SELECT COALESCE(points, 0) FROM customers WHERE id = (p_invoice->>'customer_id')::UUID)
        );
    END IF;

    -- 4. Insert Invoice Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        INSERT INTO invoice_items (
            invoice_id, item_name, category, quantity, unit_price, tax_rate, line_total, item_code, hsn, staff_contribution
        ) VALUES (
            new_invoice_id, 
            v_item->>'item_name', 
            v_item->>'category', 
            COALESCE((v_item->>'quantity')::INTEGER, 1), 
            (v_item->>'unit_price')::NUMERIC, 
            COALESCE((v_item->>'tax_rate')::NUMERIC, 0), 
            COALESCE((v_item->>'line_total')::NUMERIC, 0), 
            v_item->>'item_code', 
            v_item->>'hsn',
            v_item->>'staff_contribution'
        );
    END LOOP;

    RETURN jsonb_build_object('success', true, 'invoice_id', new_invoice_id, 'invoice_number', p_invoice->>'invoice_number');
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
