-- Add bank_name to parties
-- Safe to re-run: skips if column already exists (MySQL 8.0+)

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'parties'
    AND COLUMN_NAME = 'bank_name'
);

SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE parties ADD COLUMN bank_name VARCHAR(100) NULL',
  'SELECT ''bank_name already exists'' AS info'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
