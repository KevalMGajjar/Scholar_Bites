-- Add email configuration columns to university_settings
ALTER TABLE university_settings ADD COLUMN IF NOT EXISTS system_email VARCHAR(255);
ALTER TABLE university_settings ADD COLUMN IF NOT EXISTS admin_email VARCHAR(255);
ALTER TABLE university_settings ADD COLUMN IF NOT EXISTS super_admin_email VARCHAR(255);
