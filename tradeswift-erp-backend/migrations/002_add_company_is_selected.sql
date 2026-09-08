-- Add is_selected to companies (working company for whole ERP)
SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'companies'
    AND COLUMN_NAME = 'is_selected'
);

SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE companies ADD COLUMN is_selected TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT ''is_selected already exists'' AS info'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
