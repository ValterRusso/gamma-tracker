const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const MarketSnapshot = sequelize.define('MarketSnapshot', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    assetId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'asset_id',
      comment: 'FK to assets table'
    },
    timestamp: {
      type: DataTypes.BIGINT,
      allowNull: false,
      comment: 'Unix timestamp in milliseconds'
    },
    spotPrice: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
      field: 'spot_price',
      comment: 'Current spot price'
    },
    totalOptions: {
      type: DataTypes.INTEGER,
      field: 'total_options',
      comment: 'Total number of options in chain'
    },
    totalVolume: {
      type: DataTypes.DECIMAL(18, 8),
      field: 'total_volume',
      comment: 'Total 24h volume across all options'
    },
    totalOpenInterest: {
      type: DataTypes.DECIMAL(18, 8),
      field: 'total_open_interest',
      comment: 'Total open interest across all options'
    },
    totalGex: {
      type: DataTypes.DECIMAL(20, 8),
      field: 'total_gex',
      comment: 'Total Gamma Exposure (GEX)'
    },
    maxGexStrike: {
      type: DataTypes.DECIMAL(12, 2),
      field: 'max_gex_strike',
      comment: 'Strike with maximum GEX (gamma flip level)'
    },
    regime: {
      type: DataTypes.ENUM('BULLISH', 'BEARISH', 'NEUTRAL'),
      comment: 'Market regime based on GEX analysis'
    },
    // ========== NEW FIELDS: MAX PAIN ==========
    maxPainStrike: {
      type: DataTypes.DECIMAL(12, 2),
      field: 'max_pain_strike',
      comment: 'Max Pain strike - where most contracts expire OTM'
    },
    maxPainOi: {
      type: DataTypes.DECIMAL(18, 8),
      field: 'max_pain_oi',
      comment: 'Total OI at Max Pain strike'
    },
    maxPainCallOi: {
      type: DataTypes.DECIMAL(18, 8),
      field: 'max_pain_call_oi',
      comment: 'Call OI at Max Pain strike'
    },
    maxPainPutOi: {
      type: DataTypes.DECIMAL(18, 8),
      field: 'max_pain_put_oi',
      comment: 'Put OI at Max Pain strike'
    },
    maxPainDistance: {
      type: DataTypes.DECIMAL(12, 2),
      field: 'max_pain_distance',
      comment: 'Distance from spot to Max Pain (absolute)'
    },
    maxPainDistancePct: {
      type: DataTypes.DECIMAL(8, 4),
      field: 'max_pain_distance_pct',
      comment: 'Distance from spot to Max Pain (percentage)'
    },
    // ========== NEW FIELDS: SENTIMENT ==========
    putCallOiRatio: {
      type: DataTypes.DECIMAL(8, 4),
      field: 'put_call_oi_ratio',
      comment: 'Put/Call OI Ratio - sentiment indicator (>1 = bearish, <1 = bullish)'
    },
    putCallVolRatio: {
      type: DataTypes.DECIMAL(8, 4),
      field: 'put_call_vol_ratio',
      comment: 'Put/Call Volume Ratio - short-term sentiment'
    },
    sentiment: {
      type: DataTypes.ENUM('VERY_BULLISH', 'BULLISH', 'NEUTRAL', 'BEARISH', 'VERY_BEARISH'),
      comment: 'Market sentiment based on Put/Call OI Ratio'
    },
    totalCallOi: {
      type: DataTypes.DECIMAL(18, 8),
      field: 'total_call_oi',
      comment: 'Total Call open interest'
    },
    totalPutOi: {
      type: DataTypes.DECIMAL(18, 8),
      field: 'total_put_oi',
      comment: 'Total Put open interest'
    },
    totalCallVolume: {
      type: DataTypes.DECIMAL(18, 8),
      field: 'total_call_volume',
      comment: 'Total Call volume'
    },
    totalPutVolume: {
      type: DataTypes.DECIMAL(18, 8),
      field: 'total_put_volume',
      comment: 'Total Put volume'
    }
  }, {
    tableName: 'market_snapshots',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { fields: ['asset_id'] },
      { fields: ['timestamp'] },
      { fields: ['created_at'] },
      { fields: ['regime'] },
      { fields: ['sentiment'] },           // NEW INDEX
      { fields: ['max_pain_strike'] },     // NEW INDEX
      { fields: ['put_call_oi_ratio'] }    // NEW INDEX
    ]
  });

  MarketSnapshot.associate = (models) => {
    MarketSnapshot.belongsTo(models.Asset, {
      foreignKey: 'asset_id',
      as: 'asset'
    });
    MarketSnapshot.hasMany(models.OptionsHistory, {
      foreignKey: 'snapshot_id',
      as: 'options'
    });
    MarketSnapshot.hasMany(models.AnomaliesLog, {
      foreignKey: 'snapshot_id',
      as: 'anomalies'
    });
  };

  return MarketSnapshot;
};
