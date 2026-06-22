-- SQL Migration for Security Hardening: Row Level Security (RLS) Policies
-- Run this in your Supabase SQL Editor:

-- 1. Ensure transactions table and all branch columns exist
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  points_change INTEGER NOT NULL,
  transaction_type VARCHAR(20) CHECK (transaction_type IN ('add', 'redeem')),
  branch VARCHAR(50),
  notes TEXT,
  balance_after INTEGER NOT NULL,
  created_by_email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE services ADD COLUMN IF NOT EXISTS branch VARCHAR(50);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS branch VARCHAR(50);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS branch VARCHAR(50);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS branch VARCHAR(50);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS branch VARCHAR(50);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS branch VARCHAR(50);

-- 2. Enable RLS on all tables
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_audit_logs ENABLE ROW LEVEL SECURITY;

-- 3. RLS Security Policies

-- A. SERVICES POLICIES
DROP POLICY IF EXISTS "Services RLS Policy" ON services;
CREATE POLICY "Services RLS Policy" ON services
FOR ALL TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'staff'
    AND (branch IS NULL OR branch = (auth.jwt() -> 'app_metadata' ->> 'branch'))
  )
)
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'staff'
    AND (branch = (auth.jwt() -> 'app_metadata' ->> 'branch'))
  )
);

-- B. INVOICES POLICIES
DROP POLICY IF EXISTS "Invoices RLS Policy" ON invoices;
CREATE POLICY "Invoices RLS Policy" ON invoices
FOR ALL TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'staff'
    AND branch = (auth.jwt() -> 'app_metadata' ->> 'branch')
  )
)
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'staff'
    AND branch = (auth.jwt() -> 'app_metadata' ->> 'branch')
  )
);

-- C. INVOICE ITEMS POLICIES
DROP POLICY IF EXISTS "Invoice Items RLS Policy" ON invoice_items;
CREATE POLICY "Invoice Items RLS Policy" ON invoice_items
FOR ALL TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR EXISTS (
    SELECT 1 FROM invoices
    WHERE invoices.id = invoice_items.invoice_id
    AND invoices.branch = (auth.jwt() -> 'app_metadata' ->> 'branch')
  )
)
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR EXISTS (
    SELECT 1 FROM invoices
    WHERE invoices.id = invoice_items.invoice_id
    AND invoices.branch = (auth.jwt() -> 'app_metadata' ->> 'branch')
  )
);

-- D. CUSTOMERS POLICIES
DROP POLICY IF EXISTS "Customers RLS Policy" ON customers;
CREATE POLICY "Customers RLS Policy" ON customers
FOR ALL TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'staff'
    AND branch = (auth.jwt() -> 'app_metadata' ->> 'branch')
  )
)
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'staff'
    AND branch = (auth.jwt() -> 'app_metadata' ->> 'branch')
  )
);

-- E. APPOINTMENTS POLICIES
DROP POLICY IF EXISTS "Appointments RLS Policy" ON appointments;
CREATE POLICY "Appointments RLS Policy" ON appointments
FOR ALL TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'staff'
    AND branch = (auth.jwt() -> 'app_metadata' ->> 'branch')
  )
)
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'staff'
    AND branch = (auth.jwt() -> 'app_metadata' ->> 'branch')
  )
);

-- F. TRANSACTIONS POLICIES
DROP POLICY IF EXISTS "Transactions RLS Policy" ON transactions;
CREATE POLICY "Transactions RLS Policy" ON transactions
FOR ALL TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'staff'
    AND branch = (auth.jwt() -> 'app_metadata' ->> 'branch')
  )
)
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'staff'
    AND branch = (auth.jwt() -> 'app_metadata' ->> 'branch')
  )
);

-- G. AUDIT LOGS POLICIES
DROP POLICY IF EXISTS "Audit Logs RLS Policy" ON audit_logs;
CREATE POLICY "Audit Logs RLS Policy" ON audit_logs
FOR ALL TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'staff'
    AND branch = (auth.jwt() -> 'app_metadata' ->> 'branch')
  )
)
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'staff'
    AND branch = (auth.jwt() -> 'app_metadata' ->> 'branch')
  )
);
