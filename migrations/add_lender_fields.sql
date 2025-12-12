-- Add contact_email, contact_phone, and notes columns to lenders table

ALTER TABLE lenders
ADD COLUMN IF NOT EXISTS contact_email TEXT,
ADD COLUMN IF NOT EXISTS contact_phone TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add comments for documentation
COMMENT ON COLUMN lenders.contact_email IS 'Contact email address for the lender';
COMMENT ON COLUMN lenders.contact_phone IS 'Contact phone number for the lender';
COMMENT ON COLUMN lenders.notes IS 'Internal notes about the lender';

