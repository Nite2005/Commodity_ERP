-- Contract-based billing support
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS billed_qty DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE bill_line_items
  MODIFY despatch_id VARCHAR(36) NULL;

UPDATE contracts c
SET billed_qty = COALESCE((
  SELECT SUM(bli.quantity) FROM bill_line_items bli WHERE bli.contract_id = c.id
), 0);
