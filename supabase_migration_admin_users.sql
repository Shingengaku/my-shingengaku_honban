-- Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert default admin if not exists
-- Note: Storing plain text password for now as per "simple" requirement, 
-- but code should hash it. For this migration, we'll assume the code will handle hashing,
-- or we insert a raw string and the code compares raw string for the first login?
-- To be safe, let's just insert a known plaintext and have the app hash it on comparison?
-- Or simpler: The app expects a hash. I should generate a hash for 'admin123'.
-- SHA-256 of 'admin123' (hex) is:
-- 240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9
-- But wait, if I want to keep it simple, I'll implement hashing in the API.
-- Use SHA-256.

INSERT INTO admin_users (username, password_hash)
VALUES ('admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9')
ON CONFLICT (username) DO NOTHING;
