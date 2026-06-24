-- Drop the existing single RLS policy covering all operations on customers
DROP POLICY IF EXISTS "Customers RLS Policy" ON customers;

-- Create SELECT policy (Allow all staff/admins to select any customer globally)
DROP POLICY IF EXISTS "Allow all authenticated users to read customers" ON customers;
CREATE POLICY "Allow all authenticated users to read customers" ON customers
FOR SELECT TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'staff')
);

-- Create INSERT policy (Allow all staff/admins to register customers)
DROP POLICY IF EXISTS "Allow all authenticated users to insert customers" ON customers;
CREATE POLICY "Allow all authenticated users to insert customers" ON customers
FOR INSERT TO authenticated
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'staff')
);

-- Create UPDATE policy (Allow all staff/admins to update customer points and profiles)
DROP POLICY IF EXISTS "Allow all authenticated users to update customers" ON customers;
CREATE POLICY "Allow all authenticated users to update customers" ON customers
FOR UPDATE TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'staff')
)
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'staff')
);

-- Create DELETE policy (Only allow administrators to delete customers)
DROP POLICY IF EXISTS "Only admin users can delete customers" ON customers;
CREATE POLICY "Only admin users can delete customers" ON customers
FOR DELETE TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);
