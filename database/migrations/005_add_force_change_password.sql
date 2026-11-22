-- Migration: 005_add_force_change_password.sql
-- Adds FORCE_CHANGE_PASSWORD flag to OFFICER table to require password change on first login.

USE URBAN_EYE;

SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'OFFICER' 
      AND COLUMN_NAME = 'FORCE_CHANGE_PASSWORD'
);

SET @sql_force = IF(@col_exists = 0,
    "ALTER TABLE OFFICER ADD COLUMN FORCE_CHANGE_PASSWORD TINYINT(1) NOT NULL DEFAULT 0 AFTER IS_ACTIVE",
    "SELECT 'FORCE_CHANGE_PASSWORD already exists' AS info"
);
PREPARE stmt_force FROM @sql_force;
EXECUTE stmt_force;
DEALLOCATE PREPARE stmt_force;
