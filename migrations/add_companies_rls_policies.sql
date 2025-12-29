-- Enable RLS on companies table
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Clients can insert their own companies" ON companies;
DROP POLICY IF EXISTS "Clients can view their own companies" ON companies;
DROP POLICY IF EXISTS "Clients can update their own companies" ON companies;
DROP POLICY IF EXISTS "Partners can view companies they referred" ON companies;
DROP POLICY IF EXISTS "Admins have full access to companies" ON companies;

-- Policy 1: Any authenticated user can insert companies (during onboarding)
-- This allows users to create their company before their profile role is fully set
CREATE POLICY "Clients can insert their own companies"
ON companies
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy 2: Clients can view companies they own
CREATE POLICY "Clients can view their own companies"
ON companies
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role = 'CLIENT'
      AND company_id = companies.id
  )
);

-- Policy 3: Clients can update companies they own
-- Also allow updates for companies created recently (within 1 hour) by authenticated users without company_id (onboarding)
CREATE POLICY "Clients can update their own companies"
ON companies
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND (
        -- They own the company
        (role = 'CLIENT' AND company_id = companies.id)
        OR
        -- Allow during onboarding: user without company_id can update recently created companies
        -- This handles the case where they create a company and immediately update it
        (company_id IS NULL AND companies.created_at > NOW() - INTERVAL '1 hour')
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND (
        (role = 'CLIENT' AND company_id = companies.id)
        OR
        (company_id IS NULL AND companies.created_at > NOW() - INTERVAL '1 hour')
      )
  )
);

-- Policy 4: Partners can view companies they referred
CREATE POLICY "Partners can view companies they referred"
ON companies
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    JOIN profiles cu ON cu.id = auth.uid()
    WHERE cu.role = 'PARTNER'
      AND (
        -- Partner user who referred the company
        companies.referred_by = auth.uid()
        OR
        -- Any user in the same partner company who referred the company
        (companies.referred_by = p.id 
         AND p.partner_company_id IS NOT NULL 
         AND cu.partner_company_id = p.partner_company_id)
      )
  )
);

-- Policy 5: Admins have full access to companies
CREATE POLICY "Admins have full access to companies"
ON companies
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role = 'ADMIN'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role = 'ADMIN'
  )
);

