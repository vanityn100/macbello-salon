-- 1. Add revision columns to invoices table
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS revision_number INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS edited_by TEXT,
ADD COLUMN IF NOT EXISTS edit_reason TEXT;

-- 2. Create invoice_history table
CREATE TABLE IF NOT EXISTS invoice_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    history_created_at TIMESTAMPTZ DEFAULT now(),
    invoice_id UUID NOT NULL,
    revision_number INT NOT NULL,
    subtotal NUMERIC(10, 2),
    total_tax NUMERIC(10, 2),
    discount NUMERIC(10, 2),
    grand_total NUMERIC(10, 2),
    payment_method TEXT,
    edited_by TEXT,
    edited_at TIMESTAMPTZ,
    edit_reason TEXT
);

-- 3. Create invoice_item_history table
CREATE TABLE IF NOT EXISTS invoice_item_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    history_id UUID REFERENCES invoice_history(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL,
    item_name TEXT,
    category TEXT,
    quantity INT,
    unit_price NUMERIC(10, 2),
    tax_rate NUMERIC(5, 2),
    line_total NUMERIC(10, 2),
    item_code TEXT,
    hsn TEXT
);

-- 4. Create update_invoice_with_inventory RPC
CREATE OR REPLACE FUNCTION update_invoice_with_inventory(
    p_invoice_id UUID,
    p_invoice JSONB,
    p_items JSONB,
    p_retail_deductions JSONB,
    p_edit_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $
DECLARE
    v_old_invoice RECORD;
    v_old_item RECORD;
    v_old_inv_txn RECORD;
    v_old_loyalty_txn RECORD;
    v_history_id UUID;
    v_new_revision INT;
    v_item JSONB;
    v_retail JSONB;
    v_new_invoice_id UUID;
BEGIN
    -- 1. Lock the invoice
    SELECT * INTO v_old_invoice FROM invoices WHERE id = p_invoice_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invoice not found.');
    END IF;
    IF v_old_invoice.status != 'active' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot edit a deleted or archived invoice.');
    END IF;

    v_new_revision := COALESCE(v_old_invoice.revision_number, 0) + 1;

    -- 2. Archive Current Invoice
    INSERT INTO invoice_history (
        invoice_id, revision_number, subtotal, total_tax, discount, 
        grand_total, payment_method, edited_by, edited_at, edit_reason
    ) VALUES (
        p_invoice_id, v_new_revision - 1, v_old_invoice.subtotal, v_old_invoice.total_tax, v_old_invoice.discount,
        v_old_invoice.grand_total, v_old_invoice.payment_method, v_old_invoice.edited_by, v_old_invoice.edited_at, v_old_invoice.edit_reason
    ) RETURNING id INTO v_history_id;

    -- 3. Archive Current Invoice Items and Delete them
    FOR v_old_item IN SELECT * FROM invoice_items WHERE invoice_id = p_invoice_id LOOP
        INSERT INTO invoice_item_history (
            history_id, invoice_id, item_name, category, quantity, unit_price, tax_rate, line_total, item_code, hsn
        ) VALUES (
            v_history_id, p_invoice_id, v_old_item.item_name, v_old_item.category, v_old_item.quantity, 
            v_old_item.unit_price, v_old_item.tax_rate, v_old_item.line_total, v_old_item.item_code, v_old_item.hsn
        );
    END LOOP;
    
    DELETE FROM invoice_items WHERE invoice_id = p_invoice_id;

    -- 4. Reverse Inventory
    FOR v_old_inv_txn IN SELECT * FROM inventory_transactions WHERE reference_id = p_invoice_id AND type = 'SALE' LOOP
        -- Restore stock
        UPDATE branch_inventory 
        SET current_stock = current_stock + v_old_inv_txn.quantity
        WHERE branch_name = v_old_inv_txn.branch AND product_id = v_old_inv_txn.product_id;
        
        -- Insert reversal transaction
        INSERT INTO inventory_transactions (
            product_id, type, quantity, branch, reference_id, notes
        ) VALUES (
            v_old_inv_txn.product_id, 'ADJUSTMENT', v_old_inv_txn.quantity, v_old_inv_txn.branch, p_invoice_id, 'Invoice Edit Reversal'
        );
    END LOOP;

    -- 5. Reverse Loyalty
    FOR v_old_loyalty_txn IN SELECT * FROM transactions WHERE reference_id = p_invoice_id LOOP
        IF v_old_loyalty_txn.type = 'earned' THEN
            UPDATE customers SET points_balance = points_balance - v_old_loyalty_txn.points WHERE id = v_old_invoice.customer_id;
        ELSIF v_old_loyalty_txn.type = 'redeemed' THEN
            UPDATE customers SET points_balance = points_balance + v_old_loyalty_txn.points WHERE id = v_old_invoice.customer_id;
        END IF;

        -- Insert reversal transaction
        INSERT INTO transactions (
            customer_id, type, points, description, reference_id, created_by
        ) VALUES (
            v_old_invoice.customer_id, 
            CASE WHEN v_old_loyalty_txn.type = 'earned' THEN 'adjustment_deduct' ELSE 'adjustment_add' END, 
            v_old_loyalty_txn.points, 
            'Invoice Edit Reversal', 
            p_invoice_id, 
            (p_invoice->>'created_by')
        );
    END LOOP;

    -- 6. Check Inventory for New Items
    FOR v_retail IN SELECT * FROM jsonb_array_elements(p_retail_deductions) LOOP
        IF NOT EXISTS (
            SELECT 1 FROM branch_inventory 
            WHERE branch_name = v_old_invoice.branch 
            AND product_id = (v_retail->>'product_id')::UUID 
            AND current_stock >= (v_retail->>'quantity')::INT
        ) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Insufficient stock for product: ' || (v_retail->>'item_name'));
        END IF;
    END LOOP;

    -- 7. Deduct Inventory for New Items
    FOR v_retail IN SELECT * FROM jsonb_array_elements(p_retail_deductions) LOOP
        UPDATE branch_inventory 
        SET current_stock = current_stock - (v_retail->>'quantity')::INT
        WHERE branch_name = v_old_invoice.branch AND product_id = (v_retail->>'product_id')::UUID;
        
        INSERT INTO inventory_transactions (
            product_id, type, quantity, branch, reference_id, notes
        ) VALUES (
            (v_retail->>'product_id')::UUID, 'SALE', (v_retail->>'quantity')::INT, v_old_invoice.branch, p_invoice_id, 'Invoice Edit'
        );
    END LOOP;

    -- 8. Apply New Loyalty
    IF (p_invoice->>'points_redeemed')::INT > 0 THEN
        UPDATE customers SET points_balance = points_balance - (p_invoice->>'points_redeemed')::INT WHERE id = v_old_invoice.customer_id;
        INSERT INTO transactions (customer_id, type, points, description, reference_id, created_by)
        VALUES (v_old_invoice.customer_id, 'redeemed', (p_invoice->>'points_redeemed')::INT, 'Points redeemed on edit', p_invoice_id, p_invoice->>'created_by');
    END IF;

    IF (p_invoice->>'points_earned')::INT > 0 THEN
        UPDATE customers SET points_balance = points_balance + (p_invoice->>'points_earned')::INT WHERE id = v_old_invoice.customer_id;
        INSERT INTO transactions (customer_id, type, points, description, reference_id, created_by)
        VALUES (v_old_invoice.customer_id, 'earned', (p_invoice->>'points_earned')::INT, 'Points earned on edit', p_invoice_id, p_invoice->>'created_by');
    END IF;

    -- 9. Insert New Invoice Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        INSERT INTO invoice_items (
            invoice_id, item_name, category, quantity, unit_price, tax_rate, line_total, item_code, hsn, staff_contribution
        ) VALUES (
            p_invoice_id, 
            v_item->>'item_name', 
            v_item->>'category', 
            (v_item->>'quantity')::INT, 
            (v_item->>'unit_price')::NUMERIC, 
            (v_item->>'tax_rate')::NUMERIC, 
            (v_item->>'line_total')::NUMERIC, 
            v_item->>'item_code', 
            v_item->>'hsn',
            v_item->>'staff_contribution'
        );
    END LOOP;

    -- 10. Update Invoice
    UPDATE invoices SET
        subtotal = (p_invoice->>'subtotal')::NUMERIC,
        service_tax = (p_invoice->>'service_tax')::NUMERIC,
        retail_tax = (p_invoice->>'retail_tax')::NUMERIC,
        total_tax = (p_invoice->>'total_tax')::NUMERIC,
        discount = (p_invoice->>'discount')::NUMERIC,
        grand_total = (p_invoice->>'grand_total')::NUMERIC,
        points_earned = (p_invoice->>'points_earned')::INT,
        points_redeemed = (p_invoice->>'points_redeemed')::INT,
        payment_method = p_invoice->>'payment_method',
        revision_number = v_new_revision,
        edited_at = NOW(),
        edited_by = p_invoice->>'created_by',
        edit_reason = p_edit_reason
    WHERE id = p_invoice_id;

    RETURN jsonb_build_object('success', true, 'invoice_id', p_invoice_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$;
