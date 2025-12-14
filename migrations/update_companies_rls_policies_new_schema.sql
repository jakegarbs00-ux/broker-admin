-- RLS Policies for Companies Table - Updated for New Schema
-- New schema: companies.referred_by (not profiles.referred_by), profiles.company_id (not companies.owner_id)

-- Enable RLS on companies table (if not already enabled)
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Partners can insert companies for referred clients" ON companies;
DROP POLICY IF EXISTS "Partners can view companies of referred clients" ON companies;
DROP POLICY IF EXISTS "Clients can manage their own companies" ON companies;
DROP POLICY IF EXISTS "Admins have full access to companies" ON companies;
DROP POLICY IF EXISTS "Partners can update companies of referred clients" ON companies;
DROP POLICY IF EXISTS "CLIENT INSERT" ON companies;
DROP POLICY IF EXISTS "CLIENT UPDATE" ON companies;

-- Policy 1: Partners can INSERT companies
-- Partners can create companies and set referred_by to themselves
CREATE POLICY "Partners can insert companies"
ON companies
FOR INSERT
TO authenticated
WITH CHECK (
  -- User must be a PARTNER
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'PARTNER'
  )
  AND
  -- The referred_by field should match the partner creating it
  referred_by = auth.uid()
);

-- Policy 2: Partners can SELECT companies they referred
CREATE POLICY "Partners can view companies they referred"
ON companies
FOR SELECT
TO authenticated
USING (
  -- User is a PARTNER and the company was referred by them
  (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'PARTNER'
    )
    AND referred_by = auth.uid()
  )
  OR
  -- User is an ADMIN
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);

-- Policy 3: Partners can UPDATE companies they referred
CREATE POLICY "Partners can update companies they referred"
ON companies
FOR UPDATE
TO authenticated
USING (
  -- User is a PARTNER and the company was referred by them
  (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'PARTNER'
    )
    AND referred_by = auth.uid()
  )
  OR
  -- User is an ADMIN
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
)
WITH CHECK (
  -- Same conditions for update
  (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'PARTNER'
    )
    AND referred_by = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);

-- Policy 4: Clients can SELECT their own company (via profiles.company_id)
CREATE POLICY "Clients can view their own company"
ON companies
FOR SELECT
TO authenticated
USING (
  -- User is a CLIENT and has this company_id set in their profile
  (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'CLIENT'
      AND profiles.company_id = companies.id
    )
  )
  OR
  -- User is an ADMIN
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);

-- Policy 5: Clients can UPDATE their own company
CREATE POLICY "Clients can update their own company"
ON companies
FOR UPDATE
TO authenticated
USING (
  -- User is a CLIENT and has this company_id set in their profile
  (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'CLIENT'
      AND profiles.company_id = companies.id
    )
  )
  OR
  -- User is an ADMIN
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
)
WITH CHECK (
  -- Same conditions
  (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'CLIENT'
      AND profiles.company_id = companies.id
    )
  )
  OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);

-- Policy 6: Admins have full access
CREATE POLICY "Admins have full access to companies"
ON companies
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);

