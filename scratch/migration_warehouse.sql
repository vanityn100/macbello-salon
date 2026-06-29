-- Safe Warehouse & Branch Allocations Migration
-- Do NOT modify existing tables, just add new columns/tables.

-- 1. Add Total Received Tracker
ALTER TABLE services ADD COLUMN IF NOT EXISTS total_received INTEGER DEFAULT 0;

-- 2. Create Allocations Tracker (Historical Cumulative)
CREATE TABLE IF NOT EXISTS product_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES services(id) ON DELETE CASCADE,
    branch VARCHAR(255) NOT NULL,
    allocated_quantity INTEGER DEFAULT 0,
    UNIQUE(product_id, branch)
);

-- RLS for Allocations Tracker
ALTER TABLE product_allocations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Product Allocations Policy" ON product_allocations;
CREATE POLICY "Product Allocations Policy" ON product_allocations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Enhance Transactions
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS source VARCHAR(255);
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS destination VARCHAR(255);
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS notes TEXT;
