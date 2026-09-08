-- Add FIXED / PERCENTAGE rate type on billing rate master
ALTER TABLE rate_masters
  ADD COLUMN rate_type ENUM('FIXED','PERCENTAGE') NOT NULL DEFAULT 'FIXED';
