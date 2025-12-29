const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const OptionsHistory = sequelize.define('OptionsHistory', {
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
      comment: 'FK to assets (denormalized for performance)'
    },
    symbol: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Option symbol (BTC-250131-95000-C)'
    },
    strike: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      comment: 'Strike price' 
    },
    expiryDate: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'expiry_date',
      comment: 'Expiry timestamp (ms)'
    },
    dte: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Days to expiration'
    },
    side: {
      type: DataTypes.ENUM('CALL', 'PUT'),
      allowNull: false,
      comment: 'Option type'
    },
    markPrice: {
      type: DataTypes.DECIMAL(18, 8),
      field: 'mark_price',
      comment: 'Mark price'
    },
    markIv: {
      type: DataTypes.DECIMAL(8, 6),
      field: 'mark_iv',
      comment: 'Implied volatility'
    },
    underlyingPrice: {
      type: DataTypes.DECIMAL(12, 2),
      field: 'underlying_price',
      comment: 'Underlying asset price'
    },
    delta: {
      type: DataTypes.DECIMAL(10, 8),
      comment: 'Delta greek'
    },
    gamma: {
      type: DataTypes.DECIMAL(12, 10),
      comment: 'Gamma greek'
    },
    theta: {
      type: DataTypes.DECIMAL(10, 8),
      comment: 'Theta greek'
    },
    vega: {
      type: DataTypes.DECIMAL(10, 8),
      comment: 'Vega greek'
    },
    volume: {
      type: DataTypes.DECIMAL(18, 8),
      comment: '24h volume'
    },
    openInterest: {
      type: DataTypes.DECIMAL(18, 8),
      field: 'open_interest',
      comment: 'Open interest'
    },
    bidPrice: {
      type: DataTypes.DECIMAL(18, 8),
      field: 'bid_price',
      comment: 'Best bid'
    },
    askPrice: {
      type: DataTypes.DECIMAL(18, 8),
      field: 'ask_price',
      comment: 'Best ask'
    }
  }, {
    tableName: 'options_history',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { fields: ['snapshot_id'] },
      { fields: ['asset_id', 'strike', 'dte'] },
      { fields: ['symbol'] },
      { fields: ['expiry_date'] },
      { fields: ['created_at'] }
    ]
  });

  OptionsHistory.associate = (models) => {
    OptionsHistory.belongsTo(models.MarketSnapshot, {
      foreignKey: 'snapshot_id',
      as: 'snapshot'
    });
    OptionsHistory.belongsTo(models.Asset, {
      foreignKey: 'asset_id',
      as: 'asset'
    });
  };

  return OptionsHistory;
};