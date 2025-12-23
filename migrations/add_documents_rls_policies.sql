-- Enable RLS on documents table
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Clients can insert documents for their own applications" ON documents;
DROP POLICY IF EXISTS "Clients can view documents for their own applications" ON documents;
DROP POLICY IF EXISTS "Partners can view documents for referred companies" ON documents;
DROP POLICY IF EXISTS "Admins have full access to documents" ON documents;
DROP POLICY IF EXISTS "Users can view documents for their applications" ON documents;
DROP POLICY IF EXISTS "Users can update their own uploaded documents" ON documents;

-- Policy 1: Clients can insert documents for applications belonging to their company
CREATE POLICY "Clients can insert documents for their own applications"
ON documents
FOR INSERT
TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM profiles p
    JOIN applications a ON a.company_id = p.company_id
    WHERE p.id = auth.uid()
      AND p.role = 'CLIENT'
      AND p.company_id IS NOT NULL
      AND a.id = documents.application_id
  )
);

-- Policy 2: Clients can view documents for applications belonging to their company
CREATE POLICY "Clients can view documents for their own applications"
ON documents
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    JOIN applications a ON a.company_id = p.company_id
    WHERE p.id = auth.uid()
      AND p.role = 'CLIENT'
      AND p.company_id IS NOT NULL
      AND a.id = documents.application_id
  )
);

-- Policy 3: Partners can view documents for applications from companies they referred
CREATE POLICY "Partners can view documents for referred companies"
ON documents
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM applications a
    JOIN companies c ON c.id = a.company_id
    JOIN profiles p ON p.id = c.referred_by
    JOIN profiles cu ON cu.id = auth.uid()
    WHERE a.id = documents.application_id
      AND cu.role = 'PARTNER'
      AND (
        -- Partner user who referred the company
        p.id = auth.uid()
        OR
        -- Any user in the same partner company
        (p.partner_company_id IS NOT NULL 
         AND cu.partner_company_id = p.partner_company_id)
      )
  )
);

-- Policy 4: Admins have full access to documents
CREATE POLICY "Admins have full access to documents"
ON documents
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

-- Policy 5: Users can update documents they uploaded (optional - for future use)
CREATE POLICY "Users can update their own uploaded documents"
ON documents
FOR UPDATE
TO authenticated
USING (uploaded_by = auth.uid())
WITH CHECK (uploaded_by = auth.uid());

