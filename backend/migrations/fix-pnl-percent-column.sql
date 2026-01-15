-- Migration: Fix pnl_percent column out of range error
-- Date: 2026-01-15
-- Issue: DECIMAL(5,2) too small for percentage values > 999.99 or < -999.99
-- Solution: Change to DECIMAL(10,2) to support larger percentage values

-- Alter pnl_percent column
ALTER TABLE bot_trades 
MODIFY COLUMN pnl_percent DECIMAL(10, 2) NULL 
COMMENT 'P&L as percentage of max risk';

-- Verify the change
DESCRIBE bot_trades;
