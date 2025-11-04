-- Initialize Spartan database with required tables
-- This file is automatically executed when MySQL container starts for the first time

-- Ensure database exists
CREATE DATABASE IF NOT EXISTS spartan_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE spartan_db;

-- Grant privileges
GRANT ALL PRIVILEGES ON spartan_db.* TO 'spartan_user'@'%';
FLUSH PRIVILEGES;

-- Add any additional table initialization here if needed
-- Example:
-- CREATE TABLE IF NOT EXISTS example_table (
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

