-- Add Email and Reset Token columns to admin_users
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS reset_token TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP WITH TIME ZONE;
