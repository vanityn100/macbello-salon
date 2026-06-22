-- SQL Migration for Staff Contribution Column
-- Run this query in your Supabase SQL Editor:

ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS staff_contribution VARCHAR(255);
