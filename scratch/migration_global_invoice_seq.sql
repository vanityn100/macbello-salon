-- 1. Create a global sequence starting at 1
CREATE SEQUENCE IF NOT EXISTS global_invoice_seq START 1;

-- 2. Update existing historical invoices to the new format sequentially
DO $$
DECLARE
    r RECORD;
    new_inv_num TEXT;
BEGIN
    FOR r IN SELECT id, created_at FROM invoices ORDER BY created_at ASC
    LOOP
        new_inv_num := 'INV-' || TO_CHAR(r.created_at, 'YYYY') || '-' || LPAD(nextval('global_invoice_seq')::TEXT, 6, '0');
        UPDATE invoices SET invoice_number = new_inv_num WHERE id = r.id;
    END LOOP;
END;
$$;

-- 3. Add UNIQUE constraint to guarantee duplicate invoice numbers are impossible
ALTER TABLE invoices ADD CONSTRAINT unique_invoice_number UNIQUE (invoice_number);

-- 4. Update the RPC to generate the invoice number atomically
CREATE OR REPLACE FUNCTION create_invoice_with_inventory(
    p_invoice JSONB,
    p_items JSONB,
    p_retail_deductions JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invoice_id UUID;
    v_new_invoice_number VARCHAR;
    v_item JSONB;
    v_deduction JSONB;
    v_current_stock INTEGER;
    v_minimum_stock INTEGER;
    v_branch VARCHAR;
    v_product_name VARCHAR;
    v_created_at TIMESTAMP WITH TIME ZONE;
BEGIN
    -- STEP 1: Validate and Deduct Inventory with Row-Level Locking
    FOR v_deduction IN SELECT * FROM jsonb_array_elements(p_retail_deductions)
    LOOP
        v_branch := v_deduction->>'branch';
        SELECT name INTO v_product_name FROM services WHERE id = (v_deduction->>'product_id')::UUID;
        
        SELECT current_stock, minimum_stock INTO v_current_stock, v_minimum_stock
        FROM branch_inventory
        WHERE service_id = (v_deduction->>'product_id')::UUID
          AND branch = v_branch
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Inventory record not found for product % in branch %', COALESCE(v_product_name, v_deduction->>'product_id'), v_branch;
        END IF;

        IF v_current_stock < (v_deduction->>'quantity')::INTEGER THEN
            RAISE EXCEPTION 'Insufficient stock. Only % units of % available in %.', v_current_stock, v_product_name, v_branch;
        END IF;

        UPDATE branch_inventory
        SET current_stock = current_stock - (v_deduction->>'quantity')::INTEGER
        WHERE service_id = (v_deduction->>'product_id')::UUID
          AND branch = v_branch;
    END LOOP;

    -- STEP 2: Generate the Invoice Number ATOMICALLY
    v_created_at := COALESCE((p_invoice->>'created_at')::TIMESTAMP WITH TIME ZONE, now());
    v_new_invoice_number := 'INV-' || TO_CHAR(v_created_at, 'YYYY') || '-' || LPAD(nextval('global_invoice_seq')::TEXT, 6, '0');

    -- STEP 3: Create the Invoice
    INSERT INTO invoices (
        invoice_number, customer_id, customer_name, customer_phone, customer_gstin,
        subtotal, service_tax, retail_tax, total_tax, discount, grand_total,
        points_earned, points_redeemed, created_by, branch, payment_method, status, created_at
    ) VALUES (
        v_new_invoice_number,
        (p_invoice->>'customer_id')::UUID,
        p_invoice->>'customer_name',
        p_invoice->>'customer_phone',
        p_invoice->>'customer_gstin',
        (p_invoice->>'subtotal')::NUMERIC,
        (p_invoice->>'service_tax')::NUMERIC,
        (p_invoice->>'retail_tax')::NUMERIC,
        (p_invoice->>'total_tax')::NUMERIC,
        (p_invoice->>'discount')::NUMERIC,
        (p_invoice->>'grand_total')::NUMERIC,
        (p_invoice->>'points_earned')::INTEGER,
        (p_invoice->>'points_redeemed')::INTEGER,
        p_invoice->>'created_by',
        p_invoice->>'branch',
        p_invoice->>'payment_method',
        COALESCE(p_invoice->>'status', 'active'),
        v_created_at
    ) RETURNING id INTO v_invoice_id;

    -- STEP 4: Create Invoice Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO invoice_items (
            invoice_id, item_name, category, quantity, unit_price,
            tax_rate, line_total, item_code, hsn, staff_contribution
        ) VALUES (
            v_invoice_id,
            v_item->>'item_name',
            v_item->>'category',
            (v_item->>'quantity')::INTEGER,
            (v_item->>'unit_price')::NUMERIC,
            (v_item->>'tax_rate')::NUMERIC,
            (v_item->>'line_total')::NUMERIC,
            v_item->>'item_code',
            v_item->>'hsn',
            v_item->>'staff_contribution'
        );
    END LOOP;

    -- STEP 5: Loyalty Points Transaction
    IF (p_invoice->>'points_redeemed')::INTEGER > 0 THEN
        INSERT INTO loyalty_transactions (customer_id, invoice_id, branch, points, transaction_type, reason)
        VALUES (
            (p_invoice->>'customer_id')::UUID,
            v_invoice_id,
            p_invoice->>'branch',
            (p_invoice->>'points_redeemed')::INTEGER,
            'REDEEM',
            'Redeemed points for invoice ' || v_new_invoice_number
        );
        UPDATE customers SET loyalty_points = loyalty_points - (p_invoice->>'points_redeemed')::INTEGER WHERE id = (p_invoice->>'customer_id')::UUID;
    END IF;

    IF (p_invoice->>'points_earned')::INTEGER > 0 THEN
        INSERT INTO loyalty_transactions (customer_id, invoice_id, branch, points, transaction_type, reason)
        VALUES (
            (p_invoice->>'customer_id')::UUID,
            v_invoice_id,
            p_invoice->>'branch',
            (p_invoice->>'points_earned')::INTEGER,
            'EARN',
            'Earned points from invoice ' || v_new_invoice_number
        );
        UPDATE customers SET loyalty_points = loyalty_points + (p_invoice->>'points_earned')::INTEGER WHERE id = (p_invoice->>'customer_id')::UUID;
    END IF;

    -- STEP 6: Inventory Audit Transactions
    FOR v_deduction IN SELECT * FROM jsonb_array_elements(p_retail_deductions)
    LOOP
        v_branch := v_deduction->>'branch';
        
        -- Get current stock AGAIN to log as new_stock
        SELECT current_stock INTO v_current_stock
        FROM branch_inventory
        WHERE service_id = (v_deduction->>'product_id')::UUID
          AND branch = v_branch;

        INSERT INTO inventory_transactions (
            product_id, branch, user_id, action, quantity, notes, created_at,
            invoice_id, invoice_number, previous_stock, new_stock
        ) VALUES (
            (v_deduction->>'product_id')::UUID,
            v_branch,
            p_invoice->>'created_by',
            'SALE',
            (v_deduction->>'quantity')::INTEGER,
            'Sold via invoice ' || v_new_invoice_number,
            now(),
            v_invoice_id,
            v_new_invoice_number,
            v_current_stock + (v_deduction->>'quantity')::INTEGER,
            v_current_stock
        );
    END LOOP;

    -- RETURN JSON object with both ID and the newly generated invoice number
    RETURN jsonb_build_object('invoice_id', v_invoice_id, 'invoice_number', v_new_invoice_number);
END;
$$;
