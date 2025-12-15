-- Migration: Update Database Schema to Match New Structure
-- 
-- IMPORTANT: Run this migration BEFORE running the RLS policies migration
-- 
-- This migration updates the schema to match the new structure where:
-- - Companies no longer have owner_id or director_* fields
-- - Applications no longer have owner_id
-- - Profiles have company_id, is_primary_director, and director details (address, dob, property_status)
-- - Companies have referred_by (not profiles)
--
-- After running this migration, run: migrations/add_companies_rls_policies.sql

-- ============================================
-- 1. PROFILES TABLE UPDATES
-- ============================================

-- Add company_id column (foreign key to companies)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- Add is_primary_director column
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_primary_director BOOLEAN DEFAULT false;

-- Add director personal details columns (for CLIENTs)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS dob DATE,
ADD COLUMN IF NOT EXISTS property_status TEXT CHECK (property_status IN ('owner', 'renter') OR property_status IS NULL);

-- Remove referred_by from profiles (if it exists - it's now only on companies)
-- Note: Only drop if you're sure it's not needed elsewhere
-- ALTER TABLE profiles DROP COLUMN IF EXISTS referred_by;

-- Create index on company_id for performance
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_is_primary_director ON profiles(is_primary_director) WHERE is_primary_director = true;

-- ============================================
-- 2. COMPANIES TABLE UPDATES
-- ============================================

-- Drop foreign key constraint on owner_id if it exists (before dropping the column)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'companies_owner_id_fkey'
  ) THEN
    ALTER TABLE companies DROP CONSTRAINT companies_owner_id_fkey;
  END IF;
END $$;

-- Remove owner_id column (if it exists)
ALTER TABLE companies DROP COLUMN IF EXISTS owner_id;

-- Remove director fields from companies (if they exist)
ALTER TABLE companies DROP COLUMN IF EXISTS director_full_name;
ALTER TABLE companies DROP COLUMN IF EXISTS director_email;
ALTER TABLE companies DROP COLUMN IF EXISTS director_phone;
ALTER TABLE companies DROP COLUMN IF EXISTS director_address;
ALTER TABLE companies DROP COLUMN IF EXISTS director_dob;

-- Add referred_by to companies if it doesn't exist (this is where referrals are stored now)
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Remove referred_by from profiles if it exists (it's now only on companies)
ALTER TABLE profiles DROP COLUMN IF EXISTS referred_by;

-- Create index on referred_by for performance
CREATE INDEX IF NOT EXISTS idx_companies_referred_by ON companies(referred_by);

-- ============================================
-- 3. APPLICATIONS TABLE UPDATES
-- ============================================

-- Drop foreign key constraint on owner_id if it exists (before dropping the column)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'applications_owner_id_fkey'
  ) THEN
    ALTER TABLE applications DROP CONSTRAINT applications_owner_id_fkey;
  END IF;
END $$;

-- Remove owner_id column (if it exists)
ALTER TABLE applications DROP COLUMN IF EXISTS owner_id;

-- Ensure company_id and created_by columns exist
ALTER TABLE applications
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_applications_company_id ON applications(company_id);
CREATE INDEX IF NOT EXISTS idx_applications_created_by ON applications(created_by);

-- ============================================
-- 4. DATA MIGRATION (if needed)
-- ============================================

-- If you have existing data, you may need to migrate it:
-- This is a placeholder - adjust based on your actual data migration needs

-- Example: If companies had owner_id, you might need to:
-- UPDATE profiles SET company_id = (SELECT id FROM companies WHERE owner_id = profiles.id LIMIT 1)
-- WHERE company_id IS NULL AND EXISTS (SELECT 1 FROM companies WHERE owner_id = profiles.id);

-- Example: If applications had owner_id, you might need to:
-- UPDATE applications SET company_id = (SELECT company_id FROM profiles WHERE id = applications.owner_id)
-- WHERE company_id IS NULL AND owner_id IS NOT NULL;

-- ============================================
-- 5. VERIFY CONSTRAINTS
-- ============================================

-- Add constraint to ensure only one primary director per company
-- (This is a partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_one_primary_director_per_company
ON profiles(company_id)
WHERE is_primary_director = true AND company_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN profiles.company_id IS 'Links CLIENT profile to their company';
COMMENT ON COLUMN profiles.is_primary_director IS 'True if this CLIENT is the primary director of the company';
COMMENT ON COLUMN companies.referred_by IS 'The partner who referred this company (null if direct signup)';
COMMENT ON COLUMN applications.company_id IS 'The company this application belongs to';
COMMENT ON COLUMN applications.created_by IS 'The profile (partner or client) who created this application';

