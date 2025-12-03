-- =====================================================
-- FIX ADMIN PASSWORD HASH - Update from bcrypt to SHA256
-- =====================================================
-- This migration fixes the admin user password hash from bcrypt to SHA256
-- to match the application's password hashing implementation

UPDATE users 
SET password_hash = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
    updated_at = NOW()
WHERE email = 'admin@saasbot.com';
