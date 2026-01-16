-- Add onboarding_step column to profiles table
-- Tracks which step (1-4) the user is on in the onboarding process
-- NULL means not started, 5 means completed
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_step integer DEFAULT NULL;

