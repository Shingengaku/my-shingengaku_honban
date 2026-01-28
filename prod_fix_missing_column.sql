-- Add generation column to members table if it doesn't exist
ALTER TABLE members ADD COLUMN IF NOT EXISTS generation INTEGER;
