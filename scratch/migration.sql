-- 1. Add service_id to invoice_items
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id) ON DELETE SET NULL;

-- 2. Update create_invoice_with_inventory RPC
CREATE OR REPLACE FUNCTION create_invoice_with_inventory(
    user_id UUID,
    p_customer_id UUID,
    p_branch VARCHAR,
    p_subtotal NUMERIC,
    p_discount NUMERIC,
    p_tax_amount NUMERIC,
    p_grand_total NUMERIC,
    p_payment_method VARCHAR,
    p_loyalty_earned INTEGER,
    p_loyalty_redeemed INTEGER,
    items_json JSONB
) RETURNS JSONB AS $$
DECLARE
    new_invoice_id UUID;
    new_invoice_number VARCHAR;
    item JSONB;
    v_service_id UUID;
    v_product_name VARCHAR;
    v_quantity INTEGER;
    v_category VARCHAR;
    v_branch_stock INTEGER;
BEGIN
    -- 1. Generate Invoice Number
    new_invoice_number := 'INV-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(CAST((floor(random() * 9000) + 1000) AS VARCHAR), 4, '0');

    -- 2. Insert Invoice
    INSERT INTO invoices (
        invoice_number, customer_id, branch, subtotal, discount,
        tax_amount, grand_total, payment_method, loyalty_earned, loyalty_redeemed, status
    ) VALUES (
        new_invoice_number, p_customer_id, p_branch, p_subtotal, p_discount,
        p_tax_amount, p_grand_total, p_payment_method, p_loyalty_earned, p_loyalty_redeemed, 'completed'
    ) RETURNING id INTO new_invoice_id;

    -- 3. Process Items & Update Inventory
    FOR item IN SELECT * FROM jsonb_array_elements(items_json)
    LOOP
        v_service_id := (item->>'id')::UUID;
        v_product_name := item->>'name';
        v_quantity := (item->>'quantity')::INTEGER;
        v_category := item->>'category';

        -- Deduct from branch_inventory if it's Retail
        IF v_category = 'Retail' THEN
            SELECT current_stock INTO v_branch_stock
            FROM branch_inventory
            WHERE service_id = v_service_id AND branch = p_branch;

            IF NOT FOUND OR v_branch_stock < v_quantity THEN
                RAISE EXCEPTION 'Insufficient stock for % in branch %', v_product_name, p_branch;
            END IF;

            UPDATE branch_inventory
            SET current_stock = current_stock - v_quantity
            WHERE service_id = v_service_id AND branch = p_branch;
        END IF;

        -- Insert into invoice_items (Now includes service_id)
        INSERT INTO invoice_items (
            invoice_id, service_id, item_name, category, quantity, unit_price, tax_rate, line_total, hsn, item_code, staff_contribution
        ) VALUES (
            new_invoice_id,
            v_service_id,
            v_product_name,
            v_category,
            v_quantity,
            (item->>'price')::NUMERIC,
            (item->>'taxRate')::NUMERIC,
            (item->>'lineTotal')::NUMERIC,
            item->>'hsn',
            item->>'itemCode',
            item->>'staffContribution'
        );
    END LOOP;

    RETURN jsonb_build_object('success', true, 'invoice_id', new_invoice_id, 'invoice_number', new_invoice_number);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Update update_invoice_with_inventory RPC
CREATE OR REPLACE FUNCTION update_invoice_with_inventory(
    p_invoice_id UUID,
    p_branch VARCHAR,
    p_subtotal NUMERIC,
    p_discount NUMERIC,
    p_tax_amount NUMERIC,
    p_grand_total NUMERIC,
    p_payment_method VARCHAR,
    items_json JSONB
) RETURNS JSONB AS $$
DECLARE
    item JSONB;
    old_item RECORD;
    v_service_id UUID;
    v_product_name VARCHAR;
    v_quantity INTEGER;
    v_category VARCHAR;
    v_diff INTEGER;
BEGIN
    -- 1. Restore old inventory
    FOR old_item IN SELECT * FROM invoice_items WHERE invoice_id = p_invoice_id LOOP
        IF old_item.category = 'Retail' AND old_item.service_id IS NOT NULL THEN
            UPDATE branch_inventory
            SET current_stock = current_stock + old_item.quantity
            WHERE service_id = old_item.service_id AND branch = p_branch;
        END IF;
    END LOOP;

    -- 2. Clear old items
    DELETE FROM invoice_items WHERE invoice_id = p_invoice_id;

    -- 3. Update invoice totals
    UPDATE invoices SET
        subtotal = p_subtotal,
        discount = p_discount,
        tax_amount = p_tax_amount,
        grand_total = p_grand_total,
        payment_method = p_payment_method
    WHERE id = p_invoice_id;

    -- 4. Process new items & deduct inventory
    FOR item IN SELECT * FROM jsonb_array_elements(items_json)
    LOOP
        v_service_id := (item->>'id')::UUID;
        v_product_name := item->>'name';
        v_quantity := (item->>'quantity')::INTEGER;
        v_category := item->>'category';

        IF v_category = 'Retail' THEN
            UPDATE branch_inventory
            SET current_stock = current_stock - v_quantity
            WHERE service_id = v_service_id AND branch = p_branch;
        END IF;

        INSERT INTO invoice_items (
            invoice_id, service_id, item_name, category, quantity, unit_price, tax_rate, line_total, hsn, item_code, staff_contribution
        ) VALUES (
            p_invoice_id,
            v_service_id,
            v_product_name,
            v_category,
            v_quantity,
            (item->>'price')::NUMERIC,
            (item->>'taxRate')::NUMERIC,
            (item->>'lineTotal')::NUMERIC,
            item->>'hsn',
            item->>'itemCode',
            item->>'staffContribution'
        );
    END LOOP;

    RETURN jsonb_build_object('success', true);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
