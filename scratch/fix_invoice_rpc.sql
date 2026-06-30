-- ============================================================
-- FIX: Duplicate invoice number race condition
-- 
-- ROOT CAUSE:
--   The RPC inserted p_invoice->>'invoice_number' which was 
--   always the literal string "TBD" sent from the app.
--   Concurrent billing requests both read "TBD" and hit the
--   unique constraint on invoices.invoice_number.
--
-- FIX:
--   Generate the invoice number atomically inside the DB
--   using pg_advisory_xact_lock() + MAX() to ensure every
--   concurrent call produces a unique, sequential number.
--
-- FORMAT: MB-YYYYMMDD-NNNNN
--   e.g.  MB-20260630-00001
--         MB-20260630-00002
--   The daily counter resets each calendar day (IST).
--   If more than 99999 invoices are created on one day,
--   the sequence continues past 5 digits naturally.
-- ============================================================

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
    new_invoice_id   UUID;
    new_invoice_num  TEXT;
    v_today_prefix   TEXT;
    v_last_seq       INTEGER;
    v_retail         JSONB;
    v_item           JSONB;
BEGIN
    -- ── Step 1: Acquire advisory lock so only one transaction 
    --           at a time can compute the next invoice number.
    --           Lock is automatically released at transaction end.
    PERFORM pg_advisory_xact_lock(1987654321);

    -- ── Step 2: Generate next sequential invoice number for today (IST = UTC+5:30)
    v_today_prefix := 'MB-' || to_char(NOW() AT TIME ZONE 'Asia/Kolkata', 'YYYYMMDD');

    SELECT COALESCE(
        MAX(
            CAST(
                NULLIF(
                    regexp_replace(invoice_number, '^MB-\d{8}-0*', '', 'g'),
                    ''
                ) AS INTEGER
            )
        ),
        0
    )
    INTO v_last_seq
    FROM invoices
    WHERE invoice_number LIKE v_today_prefix || '-%';

    new_invoice_num := v_today_prefix || '-' || LPAD((v_last_seq + 1)::TEXT, 5, '0');

    -- ── Step 3: Insert Invoice (with all snapshot fields)
    INSERT INTO invoices (
        invoice_number,
        customer_id,
        customer_name,
        customer_phone,
        customer_gstin,
        branch,
        subtotal,
        service_tax,
        retail_tax,
        total_tax,
        discount,
        grand_total,
        payment_method,
        points_earned,
        points_redeemed,
        status,
        created_at,
        created_by
    ) VALUES (
        new_invoice_num,
        (p_invoice->>'customer_id')::UUID,
        p_invoice->>'customer_name',
        p_invoice->>'customer_phone',
        p_invoice->>'customer_gstin',
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
        COALESCE(p_invoice->>'status', 'active'),
        COALESCE((p_invoice->>'created_at')::TIMESTAMPTZ, NOW()),
        p_invoice->>'created_by'
    ) RETURNING id INTO new_invoice_id;

    -- ── Step 4: Deduct Retail Inventory (atomic with invoice insert)
    FOR v_retail IN SELECT * FROM jsonb_array_elements(p_retail_deductions) LOOP

        -- Check stock availability
        IF NOT EXISTS (
            SELECT 1 FROM branch_inventory
            WHERE branch     = p_invoice->>'branch'
              AND service_id = (v_retail->>'product_id')::UUID
              AND current_stock >= (v_retail->>'quantity')::INTEGER
        ) THEN
            RAISE EXCEPTION 'Insufficient stock for product id: %', v_retail->>'product_id';
        END IF;

        -- Deduct stock
        UPDATE branch_inventory
        SET current_stock = current_stock - (v_retail->>'quantity')::INTEGER
        WHERE branch     = p_invoice->>'branch'
          AND service_id = (v_retail->>'product_id')::UUID;

        -- Audit trail
        INSERT INTO inventory_transactions (
            product_id, transaction_type, quantity, branch, invoice_id, notes, created_by
        ) VALUES (
            (v_retail->>'product_id')::UUID,
            'STOCK_OUT',
            (v_retail->>'quantity')::INTEGER,
            p_invoice->>'branch',
            new_invoice_id,
            'Invoice ' || new_invoice_num,
            p_invoice->>'created_by'
        );
    END LOOP;

    -- ── Step 5: Apply Loyalty Points
    IF COALESCE((p_invoice->>'points_redeemed')::INTEGER, 0) > 0 THEN
        UPDATE customers
        SET points = COALESCE(points, 0) - (p_invoice->>'points_redeemed')::INTEGER
        WHERE id = (p_invoice->>'customer_id')::UUID;

        INSERT INTO transactions (
            customer_id, transaction_type, points_change, notes, branch, created_by_email, balance_after
        ) VALUES (
            (p_invoice->>'customer_id')::UUID,
            'redeem',
            -(p_invoice->>'points_redeemed')::INTEGER,
            'Points redeemed on invoice ' || new_invoice_num,
            p_invoice->>'branch',
            p_invoice->>'created_by',
            (SELECT COALESCE(points, 0) FROM customers WHERE id = (p_invoice->>'customer_id')::UUID)
        );
    END IF;

    IF COALESCE((p_invoice->>'points_earned')::INTEGER, 0) > 0 THEN
        UPDATE customers
        SET points = COALESCE(points, 0) + (p_invoice->>'points_earned')::INTEGER
        WHERE id = (p_invoice->>'customer_id')::UUID;

        INSERT INTO transactions (
            customer_id, transaction_type, points_change, notes, branch, created_by_email, balance_after
        ) VALUES (
            (p_invoice->>'customer_id')::UUID,
            'add',
            (p_invoice->>'points_earned')::INTEGER,
            'Points earned on invoice ' || new_invoice_num,
            p_invoice->>'branch',
            p_invoice->>'created_by',
            (SELECT COALESCE(points, 0) FROM customers WHERE id = (p_invoice->>'customer_id')::UUID)
        );
    END IF;

    -- ── Step 6: Insert Invoice Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        INSERT INTO invoice_items (
            invoice_id, item_name, category, quantity,
            unit_price, tax_rate, line_total,
            item_code, hsn, staff_contribution
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

    -- ── Return new invoice id and the generated number
    RETURN jsonb_build_object(
        'success',        true,
        'invoice_id',     new_invoice_id,
        'invoice_number', new_invoice_num
    );

EXCEPTION
    WHEN OTHERS THEN
        -- Roll back everything (invoice, inventory, points) and return the error
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execute to authenticated role (needed for Supabase service-role calls)
GRANT EXECUTE ON FUNCTION create_invoice_with_inventory(JSONB, JSONB, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION create_invoice_with_inventory(JSONB, JSONB, JSONB) TO authenticated;
