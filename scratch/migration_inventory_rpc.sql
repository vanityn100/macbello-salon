-- SQL Migration: Branch-Aware Inventory Sync with Transaction Safety

-- 1. Ensure inventory_transactions table has the correct tracking columns for audit
ALTER TABLE inventory_transactions 
ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS previous_stock INTEGER,
ADD COLUMN IF NOT EXISTS new_stock INTEGER;

-- 2. Create the RPC function
CREATE OR REPLACE FUNCTION create_invoice_with_inventory(
    p_invoice JSONB,
    p_items JSONB,
    p_retail_deductions JSONB
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_invoice_id UUID;
    v_item JSONB;
    v_deduction JSONB;
    v_current_stock INTEGER;
    v_minimum_stock INTEGER;
    v_branch VARCHAR;
    v_product_name VARCHAR;
BEGIN
    -- STEP 1: Validate and Deduct Inventory with Row-Level Locking
    -- Loop through the requested deductions and lock the rows
    FOR v_deduction IN SELECT * FROM jsonb_array_elements(p_retail_deductions)
    LOOP
        v_branch := v_deduction->>'branch';
        
        -- Get the product name for clearer error messages
        SELECT name INTO v_product_name FROM services WHERE id = (v_deduction->>'product_id')::UUID;
        
        -- Lock the specific row in branch_inventory to prevent concurrent overselling
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

        -- Update the stock
        UPDATE branch_inventory
        SET current_stock = current_stock - (v_deduction->>'quantity')::INTEGER
        WHERE service_id = (v_deduction->>'product_id')::UUID
          AND branch = v_branch;
    END LOOP;

    -- STEP 2: Create the Invoice
    INSERT INTO invoices (
        invoice_number, customer_id, customer_name, customer_phone, customer_gstin,
        subtotal, service_tax, retail_tax, total_tax, discount, grand_total,
        points_earned, points_redeemed, created_by, branch, payment_method, status, created_at
    ) VALUES (
        p_invoice->>'invoice_number',
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
        COALESCE((p_invoice->>'created_at')::TIMESTAMP WITH TIME ZONE, now())
    ) RETURNING id INTO v_invoice_id;

    -- STEP 3: Create Invoice Items
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

    -- STEP 4: Insert Inventory Transactions
    FOR v_deduction IN SELECT * FROM jsonb_array_elements(p_retail_deductions)
    LOOP
        -- Re-fetch current_stock to calculate previous and new accurately
        SELECT current_stock INTO v_current_stock
        FROM branch_inventory
        WHERE service_id = (v_deduction->>'product_id')::UUID
          AND branch = (v_deduction->>'branch');

        INSERT INTO inventory_transactions (
            product_id, branch, transaction_type, quantity, 
            invoice_id, invoice_number, previous_stock, new_stock, created_by, created_at
        ) VALUES (
            (v_deduction->>'product_id')::UUID,
            v_deduction->>'branch',
            'SALE',
            (v_deduction->>'quantity')::INTEGER,
            v_invoice_id,
            p_invoice->>'invoice_number',
            v_current_stock + (v_deduction->>'quantity')::INTEGER, -- We already deducted, so previous is current + quantity
            v_current_stock,
            p_invoice->>'created_by',
            now()
        );
    END LOOP;

    -- STEP 5: Update Loyalty Points
    IF (p_invoice->>'customer_id') IS NOT NULL AND (p_invoice->>'customer_id') != '' THEN
        UPDATE customers
        SET points = points - (p_invoice->>'points_redeemed')::INTEGER + (p_invoice->>'points_earned')::INTEGER
        WHERE id = (p_invoice->>'customer_id')::UUID;
        
        -- Insert Loyalty transaction log
        INSERT INTO transactions (
            customer_id, points_change, transaction_type, branch, balance_after, created_by_email, notes
        ) VALUES (
            (p_invoice->>'customer_id')::UUID,
            (p_invoice->>'points_earned')::INTEGER - (p_invoice->>'points_redeemed')::INTEGER,
            CASE WHEN ((p_invoice->>'points_earned')::INTEGER - (p_invoice->>'points_redeemed')::INTEGER) >= 0 THEN 'add' ELSE 'redeem' END,
            p_invoice->>'branch',
            (SELECT points FROM customers WHERE id = (p_invoice->>'customer_id')::UUID),
            p_invoice->>'created_by',
            'Invoice ' || (p_invoice->>'invoice_number')
        );
    END IF;

    -- STEP 6: Return the created invoice_id
    RETURN jsonb_build_object('success', true, 'invoice_id', v_invoice_id);

EXCEPTION WHEN OTHERS THEN
    -- Any exception thrown above (or unexpected errors) will roll back the entire transaction automatically
    -- We catch it only to return a JSON formatted error response to the client
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
