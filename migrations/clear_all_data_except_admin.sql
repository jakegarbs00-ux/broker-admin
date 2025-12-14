-- Clear all database entries except admin account
-- WARNING: This will delete all data except admin profiles
-- Run this script in Supabase SQL Editor

-- Step 1: Delete documents (they reference applications)
DELETE FROM documents;

-- Step 2: Delete applications (they reference companies and profiles)
DELETE FROM applications;

-- Step 3: Delete companies (they reference profiles via referred_by and profiles.company_id)
-- First, clear company_id from profiles to avoid foreign key issues
UPDATE profiles SET company_id = NULL WHERE company_id IS NOT NULL;

-- Now delete all companies
DELETE FROM companies;

-- Step 4: Delete all profiles except admin accounts
-- This will delete all PARTNER and CLIENT profiles
DELETE FROM profiles 
WHERE role != 'ADMIN';

-- Optional: If you also want to delete lenders (uncomment the line below)
-- DELETE FROM lenders;

-- Verify: Check remaining profiles (should only be admin)
SELECT id, email, role, full_name 
FROM profiles 
ORDER BY created_at;

-- Note: Auth users in auth.users are NOT deleted by this script
-- If you want to delete auth users too, you'll need to do that separately
-- via Supabase Dashboard > Authentication > Users

