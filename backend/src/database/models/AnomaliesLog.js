const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AnomaliesLog = sequelize.define('AnomaliesLog', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    snapshotId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'snapshot_id',
      comment: 'FK to market_snapshots'
    },
    assetId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'asset_id',
      comment: 'FK to assets'
    },
    type: {
      type: DataTypes.ENUM('IV_OUTLIER', 'SKEW_ANOMALY'),
      allowNull: false,
      comment: 'Anomaly type'
    },
    severity: {
      type: DataTypes.ENUM('CRITICAL', 'HIGH', 'MEDIUM', 'LOW'),
      allowNull: false,
      comment: 'Severity level'
    },
    strike: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      comment: 'Strike price'
    },
    dte: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Days to expiration'
    },
    moneyness: {
      type: DataTypes.DECIMAL(8, 6),
      comment: 'Strike/Spot ratio'
    },
    iv: {
      type: DataTypes.DECIMAL(8, 6),
      comment: 'Average IV'
    },
    callIv: {
      type: DataTypes.DECIMAL(8, 6),
      field: 'call_iv',
      comment: 'Call IV'
    },
    putIv: {
      type: DataTypes.DECIMAL(8, 6),
      field: 'put_iv',
      comment: 'Put IV'
    },
    expectedIv: {
      type: DataTypes.DECIMAL(8, 6),
      field: 'expected_iv',
      comment: 'Expected IV (interpolated)'
    },
    deviation: {
      type: DataTypes.DECIMAL(10, 6),
      comment: 'Absolute deviation'
    },
    deviationPct: {
      type: DataTypes.DECIMAL(8, 4),
      field: 'deviation_pct',
      comment: 'Deviation percentage'
    },
    zScore: {
      type: DataTypes.DECIMAL(8, 4),
      allowNull: false,
      field: 'z_score',
      comment: 'Statistical z-score'
    },
    spread: {
      type: DataTypes.DECIMAL(8, 6),
      comment: 'Put-Call IV spread'
    },
    expectedSpread: {
      type: DataTypes.DECIMAL(8, 6),
      field: 'expected_spread',
      comment: 'Expected spread'
    },
    priceType: {
      type: DataTypes.ENUM('OVERPRICED', 'UNDERPRICED'),
      field: 'price_type',
      comment: 'Price classification'
    },
    skewType: {
      type: DataTypes.ENUM('PUT_PREMIUM', 'CALL_PREMIUM'),
      field: 'skew_type',
      comment: 'Skew direction'
    },
    isWing: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_wing',
      comment: 'Is wing option (deep OTM)'
    },
    relevanceScore: {
      type: DataTypes.DECIMAL(6, 4),
      field: 'relevance_score',
      comment: 'Relevance score (0-100)'
    },
    volume: {
      type: DataTypes.DECIMAL(18, 8),
      comment: '24h volume'
    },
    openInterest: {
      type: DataTypes.DECIMAL(18, 8),
      field: 'open_interest',
      comment: 'Open interest'
    }
  }, {
    tableName: 'anomalies_log',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { fields: ['snapshot_id'] },
      { fields: ['asset_id', 'severity'] },
      { fields: ['type'] },
      { fields: ['strike', 'dte'] },
      { fields: ['z_score'] },
      { fields: ['created_at'] }
    ]
  });

  AnomaliesLog.associate = (models) => {
    AnomaliesLog.belongsTo(models.MarketSnapshot, {
      foreignKey: 'snapshot_id',
      as: 'snapshot'
    });
    AnomaliesLog.belongsTo(models.Asset, {
      foreignKey: 'asset_id',
      as: 'asset'
    });
  };

  return AnomaliesLog;
};