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
      comment: 'FK to assets'
    },
    timestamp: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'timestamp',
      comment: 'Unix timestamp (ms)'
    },
    spotPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      field: 'spot_price',
      comment: 'Asset spot price'
    },
    totalOptions: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'total_options',
      comment: 'Number of active options'
    },
    totalVolume: {
      type: DataTypes.DECIMAL(18, 8),
      field: 'total_volume',
      comment: 'Total 24h volume'
    },
    totalOpenInterest: {
      type: DataTypes.DECIMAL(18, 8),
      field: 'total_open_interest',
      comment: 'Total open interest'
    },
    totalGex: {
      type: DataTypes.DECIMAL(18, 2),
      field: 'total_gex',
      comment: 'Total gamma exposure'
    },
    maxGexStrike: {
      type: DataTypes.DECIMAL(12, 2),
      field: 'max_gex_strike',
      comment: 'Strike with highest GEX'
    },
    regime: {
      type: DataTypes.STRING(20),
      comment: 'Market regime (BULLISH/BEARISH/NEUTRAL)'
    }
  }, {
    tableName: 'market_snapshots',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { fields: ['asset_id', 'timestamp'] },
      { fields: ['timestamp'] },
      { fields: ['created_at'] }
    ]
  });

  MarketSnapshot.associate = (models) => {
    MarketSnapshot.belongsTo(models.Asset, {
      foreignKey: 'asset_id',
      as: 'asset'
    });
    MarketSnapshot.hasMany(models.OptionsHistory, {
      foreignKey: 'snapshot_id',
      as: 'options',
      onDelete: 'CASCADE'
    });
    MarketSnapshot.hasMany(models.AnomaliesLog, {
      foreignKey: 'snapshot_id',
      as: 'anomalies',
      onDelete: 'CASCADE'
    });
  };

  return MarketSnapshot;
};