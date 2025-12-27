-- ============================================
-- Gamma Tracker Database Schema
-- Multi-Asset Options Analytics Platform
-- ============================================

-- Create database
CREATE DATABASE IF NOT EXISTS gamma_tracker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gamma_tracker;

-- ============================================
-- Table: assets
-- Reference table for supported assets (BTC, ETH, etc.)
-- ============================================
CREATE TABLE assets (
  id INT PRIMARY KEY AUTO_INCREMENT,
  symbol VARCHAR(10) UNIQUE NOT NULL COMMENT 'Asset symbol (BTC, ETH, SOL)',
  name VARCHAR(50) NOT NULL COMMENT 'Full asset name',
  is_active BOOLEAN DEFAULT TRUE COMMENT 'Active for data collection',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_symbol (symbol),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Supported assets for options tracking';

-- ============================================
-- Table: market_snapshots
-- Master timeline of market state snapshots
-- ============================================
CREATE TABLE market_snapshots (
  id INT PRIMARY KEY AUTO_INCREMENT,
  asset_id INT NOT NULL COMMENT 'FK to assets',
  timestamp BIGINT NOT NULL COMMENT 'Unix timestamp (ms)',
  spot_price DECIMAL(12,2) NOT NULL COMMENT 'Asset spot price',
  total_options INT NOT NULL COMMENT 'Number of active options',
  total_volume DECIMAL(18,8) COMMENT 'Total 24h volume',
  total_open_interest DECIMAL(18,8) COMMENT 'Total open interest',
  total_gex DECIMAL(18,2) COMMENT 'Total gamma exposure',
  max_gex_strike DECIMAL(12,2) COMMENT 'Strike with highest GEX',
  regime VARCHAR(20) COMMENT 'Market regime (BULLISH/BEARISH/NEUTRAL)',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (asset_id) REFERENCES assets(id),
  
  INDEX idx_asset_timestamp (asset_id, timestamp),
  INDEX idx_timestamp (timestamp),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Market state snapshots';

-- ============================================
-- Table: options_history
-- Historical data for all options contracts
-- ============================================
CREATE TABLE options_history (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  snapshot_id INT NOT NULL COMMENT 'FK to market_snapshots',
  asset_id INT NOT NULL COMMENT 'FK to assets (denormalized for performance)',
  
  symbol VARCHAR(50) NOT NULL COMMENT 'Option symbol (BTC-250131-95000-C)',
  strike DECIMAL(12,2) NOT NULL COMMENT 'Strike price',
  expiry_date BIGINT NOT NULL COMMENT 'Expiry timestamp (ms)',
  dte INT NOT NULL COMMENT 'Days to expiration',
  side ENUM('CALL', 'PUT') NOT NULL COMMENT 'Option type',
  
  mark_price DECIMAL(18,8) COMMENT 'Mark price',
  mark_iv DECIMAL(8,6) COMMENT 'Implied volatility',
  underlying_price DECIMAL(12,2) COMMENT 'Underlying asset price',
  
  delta DECIMAL(10,8) COMMENT 'Delta greek',
  gamma DECIMAL(12,10) COMMENT 'Gamma greek',
  theta DECIMAL(10,8) COMMENT 'Theta greek',
  vega DECIMAL(10,8) COMMENT 'Vega greek',
  
  volume DECIMAL(18,8) COMMENT '24h volume',
  open_interest DECIMAL(18,8) COMMENT 'Open interest',
  
  bid_price DECIMAL(18,8) COMMENT 'Best bid',
  ask_price DECIMAL(18,8) COMMENT 'Best ask',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (snapshot_id) REFERENCES market_snapshots(id) ON DELETE CASCADE,
  FOREIGN KEY (asset_id) REFERENCES assets(id),
  
  INDEX idx_snapshot (snapshot_id),
  INDEX idx_asset_strike_dte (asset_id, strike, dte),
  INDEX idx_symbol (symbol),
  INDEX idx_expiry (expiry_date),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Options contracts historical data';

-- ============================================
-- Table: anomalies_log
-- Log of detected volatility anomalies
-- ============================================
CREATE TABLE anomalies_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  snapshot_id INT NOT NULL COMMENT 'FK to market_snapshots',
  asset_id INT NOT NULL COMMENT 'FK to assets',
  
  type ENUM('IV_OUTLIER', 'SKEW_ANOMALY') NOT NULL COMMENT 'Anomaly type',
  severity ENUM('CRITICAL', 'HIGH', 'MEDIUM', 'LOW') NOT NULL COMMENT 'Severity level',
  
  strike DECIMAL(12,2) NOT NULL COMMENT 'Strike price',
  dte INT NOT NULL COMMENT 'Days to expiration',
  moneyness DECIMAL(8,6) COMMENT 'Strike/Spot ratio',
  
  iv DECIMAL(8,6) COMMENT 'Average IV',
  call_iv DECIMAL(8,6) COMMENT 'Call IV',
  put_iv DECIMAL(8,6) COMMENT 'Put IV',
  expected_iv DECIMAL(8,6) COMMENT 'Expected IV (interpolated)',
  
  deviation DECIMAL(10,6) COMMENT 'Absolute deviation',
  deviation_pct DECIMAL(8,4) COMMENT 'Deviation percentage',
  z_score DECIMAL(8,4) NOT NULL COMMENT 'Statistical z-score',
  
  spread DECIMAL(8,6) COMMENT 'Put-Call IV spread',
  expected_spread DECIMAL(8,6) COMMENT 'Expected spread',
  
  price_type ENUM('OVERPRICED', 'UNDERPRICED') COMMENT 'Price classification',
  skew_type ENUM('PUT_PREMIUM', 'CALL_PREMIUM') COMMENT 'Skew direction',
  
  is_wing BOOLEAN DEFAULT FALSE COMMENT 'Is wing option (deep OTM)',
  relevance_score DECIMAL(6,4) COMMENT 'Relevance score (0-100)',
  
  volume DECIMAL(18,8) COMMENT '24h volume',
  open_interest DECIMAL(18,8) COMMENT 'Open interest',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (snapshot_id) REFERENCES market_snapshots(id) ON DELETE CASCADE,
  FOREIGN KEY (asset_id) REFERENCES assets(id),
  
  INDEX idx_snapshot (snapshot_id),
  INDEX idx_asset_severity (asset_id, severity),
  INDEX idx_type (type),
  INDEX idx_strike_dte (strike, dte),
  INDEX idx_z_score (z_score),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Volatility anomalies detection log';

-- ============================================
-- Initial Data
-- ============================================
INSERT INTO assets (symbol, name, is_active) VALUES
('BTC', 'Bitcoin', TRUE),
('ETH', 'Ethereum', FALSE),
('SOL', 'Solana', FALSE);

-- ============================================
-- Cleanup Views (for monitoring retention)
-- ============================================
CREATE OR REPLACE VIEW v_data_retention_status AS
SELECT 
  'market_snapshots' AS table_name,
  COUNT(*) AS total_records,
  MIN(created_at) AS oldest_record,
  MAX(created_at) AS newest_record,
  TIMESTAMPDIFF(DAY, MIN(created_at), NOW()) AS retention_days
FROM market_snapshots
UNION ALL
SELECT 
  'options_history',
  COUNT(*),
  MIN(created_at),
  MAX(created_at),
  TIMESTAMPDIFF(DAY, MIN(created_at), NOW())
FROM options_history
UNION ALL
SELECT 
  'anomalies_log',
  COUNT(*),
  MIN(created_at),
  MAX(created_at),
  TIMESTAMPDIFF(DAY, MIN(created_at), NOW())
FROM anomalies_log;