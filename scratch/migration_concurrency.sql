-- ====================================================================
-- Concurrency Protection Migration
-- Run this in your Supabase SQL Editor to enforce atomic inventory locking.
-- ====================================================================

-- Update the process_inventory_sale trigger to lock the services row using FOR UPDATE
-- This prevents race conditions where two staff members sell the same limited stock item simultaneously.

CREATE OR REPLACE FUNCTION process_inventory_sale() RETURNS TRIGGER AS $$
DECLARE
    inv_branch VARCHAR(50);
    inv_created_by VARCHAR(255);
    svc_id UUID;
    svc_stock INTEGER;
BEGIN
    IF NEW.category = 'Retail' THEN
        -- Get branch and creator from parent invoice
        SELECT branch, created_by INTO inv_branch, inv_created_by 
        FROM invoices WHERE id = NEW.invoice_id;

        -- Find the retail product and LOCK IT FOR UPDATE
        -- This guarantees ACID isolation so concurrent checkouts wait in line.
        SELECT id, current_stock INTO svc_id, svc_stock 
        FROM services 
        WHERE name = NEW.item_name AND category = 'Retail' 
        AND (branch = inv_branch OR branch IS NULL)
        LIMIT 1 FOR UPDATE;

        IF FOUND THEN
            -- Strict Concurrency Check: Ensure stock doesn't drop below zero under high load
            IF svc_stock < NEW.quantity THEN
                RAISE EXCEPTION 'Concurrency Error: Insufficient stock for % (Available: %, Requested: %)', NEW.item_name, svc_stock, NEW.quantity;
            END IF;

            -- Deduct stock safely
            UPDATE services 
            SET current_stock = current_stock - NEW.quantity
            WHERE id = svc_id;
            
            -- Record transaction
            INSERT INTO inventory_transactions (product_id, branch, transaction_type, quantity, created_by)
            VALUES (svc_id, inv_branch, 'STOCK_OUT', NEW.quantity, inv_created_by);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
