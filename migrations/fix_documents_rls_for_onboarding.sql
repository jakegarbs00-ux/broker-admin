-- Fix RLS policies for documents to allow uploads during onboarding
-- This allows users to upload documents for applications they created,
-- even if company_id isn't set yet (important for onboarding flow)

-- Drop ALL existing policies that might conflict
DROP POLICY IF EXISTS "Clients can insert documents for their own applications" ON documents;
DROP POLICY IF EXISTS "Users can insert documents for their own applications" ON documents;
DROP POLICY IF EXISTS "Users can insert documents for applications they created" ON documents;

-- Drop and recreate SELECT policy
DROP POLICY IF EXISTS "Clients can view documents for their own applications" ON documents;
DROP POLICY IF EXISTS "Users can view documents for their own applications" ON documents;

-- Create updated INSERT policy that allows documents for:
-- 1. Applications created by the user (via created_by), OR
-- 2. Applications belonging to the user's company (via company_id match)
CREATE POLICY "Users can insert documents for their own applications"
ON documents
FOR INSERT
TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND (
    -- Allow if user created the application (works during onboarding)
    EXISTS (
      SELECT 1
      FROM applications a
      WHERE a.id = documents.application_id
        AND a.created_by = auth.uid()
    )
    OR
    -- Allow if application belongs to user's company (works after onboarding)
    EXISTS (
      SELECT 1
      FROM profiles p
      JOIN applications a ON a.company_id = p.company_id
      WHERE p.id = auth.uid()
        AND p.company_id IS NOT NULL
        AND a.id = documents.application_id
    )
  )
);

-- Create updated SELECT policy to match
CREATE POLICY "Users can view documents for their own applications"
ON documents
FOR SELECT
TO authenticated
USING (
  -- Allow if user created the application
  EXISTS (
    SELECT 1
    FROM applications a
    WHERE a.id = documents.application_id
      AND a.created_by = auth.uid()
  )
  OR
  -- Allow if application belongs to user's company
  EXISTS (
    SELECT 1
    FROM profiles p
    JOIN applications a ON a.company_id = p.company_id
    WHERE p.id = auth.uid()
      AND p.company_id IS NOT NULL
      AND a.id = documents.application_id
  )
  OR
  -- Allow if user uploaded the document
  uploaded_by = auth.uid()
);
