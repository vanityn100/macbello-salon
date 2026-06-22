-- SQL Migration for Roles, Branches, Appointments, and Auditing
-- Run this in your Supabase SQL Editor:

-- 1. Create Appointments Table
CREATE TABLE IF NOT EXISTS appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50) NOT NULL,
  branch VARCHAR(50) NOT NULL,
  service_id UUID REFERENCES services(id),
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'archived')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Drop strict branch constraints on invoices to allow placeholder branches ("Branch A", etc.)
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_branch_check;

-- 3. Add branch and status/archived columns for Soft Delete and Isolation support across all entities
ALTER TABLE services ADD COLUMN IF NOT EXISTS branch VARCHAR(50);
ALTER TABLE services ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'archived'));
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'archived'));
ALTER TABLE customers ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'archived'));

-- 4. Create Unified Security Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  branch VARCHAR(50),
  action VARCHAR(255) NOT NULL,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Enable Row Level Security (RLS) on new tables
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 6. Setup RLS Policies for Appointments & Audit Logs
DROP POLICY IF EXISTS "Staff Full Access Appointments" ON appointments;
CREATE POLICY "Staff Full Access Appointments" ON appointments TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Staff Full Access Audit Logs" ON audit_logs;
CREATE POLICY "Staff Full Access Audit Logs" ON audit_logs TO authenticated USING (true) WITH CHECK (true);
