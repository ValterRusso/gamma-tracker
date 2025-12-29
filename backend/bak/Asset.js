const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Asset = sequelize.define('Asset', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    symbol: {
      type: DataTypes.STRING(10),
      allowNull: false,
      unique: true,
      comment: 'Asset symbol (BTC, ETH, SOL)'
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Full asset name'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active',
      comment: 'Active for data collection'
    }
  }, {
    tableName: 'assets',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['symbol'] },
      { fields: ['is_active'] }
    ]
  });

  Asset.associate = (models) => {
    Asset.hasMany(models.MarketSnapshot, {
      foreignKey: 'asset_id',
      as: 'snapshots'
    });
    Asset.hasMany(models.OptionsHistory, {
      foreignKey: 'asset_id',
      as: 'options'
    });
    Asset.hasMany(models.AnomaliesLog, {
      foreignKey: 'asset_id',
      as: 'anomalies'
    });
  };

  return Asset;
};