-- Add tags column to applications table
ALTER TABLE applications ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
