DROP POLICY IF EXISTS ""Customers RLS Policy"" ON customers;
CREATE POLICY ""Customers RLS Policy"" ON customers
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);
