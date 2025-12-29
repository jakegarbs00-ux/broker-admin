-- Enable RLS on companies table
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Clients can insert their own companies" ON companies;
DROP POLICY IF EXISTS "Clients can view their own companies" ON companies;
DROP POLICY IF EXISTS "Clients can update their own companies" ON companies;
DROP POLICY IF EXISTS "Partners can view companies they referred" ON companies;
DROP POLICY IF EXISTS "Admins have full access to companies" ON companies;

-- Policy 1: Any authenticated user can insert companies (during onboarding)
CREATE POLICY "Clients can insert their own companies"
ON companies
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy 2: Clients can view companies they own or recently created (during onboarding)
CREATE POLICY "Clients can view their own companies"
ON companies
FOR SELECT
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
        -- During onboarding: allow viewing recently created companies (within 1 hour)
        -- This allows users to see the company they just created before profile is updated
        (company_id IS NULL AND companies.created_at > NOW() - INTERVAL '1 hour')
      )
  )
);

-- Policy 3: Allow authenticated users to update companies during onboarding
-- This is permissive but necessary for the onboarding flow
-- After onboarding, users can only update companies they own (via company_id)
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
        -- During onboarding: allow if they don't have a company_id yet
        -- This is safe because SELECT is restricted, so they can only update companies they can see
        (company_id IS NULL)
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
        (company_id IS NULL)
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
        companies.referred_by = auth.uid()
        OR
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

