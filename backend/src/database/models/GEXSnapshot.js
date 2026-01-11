const { DataTypes } = require('sequelize');

/**
 * GEXSnapshot Model - Historical GEX data by strike and timestamp
 * 
 * Stores time-series GEX data for heatmap visualization.
 * Each row represents GEX metrics for a specific strike at a specific timestamp.
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 1.0
 */

module.exports = (sequelize) => {
  const GEXSnapshot = sequelize.define('GEXSnapshot', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    timestamp: {
      type: DataTypes.BIGINT,
      allowNull: false,
      comment: 'Unix timestamp in milliseconds'
    },
    strike: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      comment: 'Strike price'
    },
    totalGex: {
      type: DataTypes.DECIMAL(20, 2),
      field: 'total_gex',
      comment: 'Total GEX at this strike (calls + puts with sign)'
    },
    callGex: {
      type: DataTypes.DECIMAL(20, 2),
      field: 'call_gex',
      comment: 'Call GEX (positive)'
    },
    putGex: {
      type: DataTypes.DECIMAL(20, 2),
      field: 'put_gex',
      comment: 'Put GEX (negative)'
    },
    callOi: {
      type: DataTypes.INTEGER,
      field: 'call_oi',
      comment: 'Call open interest'
    },
    putOi: {
      type: DataTypes.INTEGER,
      field: 'put_oi',
      comment: 'Put open interest'
    },
    totalOi: {
      type: DataTypes.INTEGER,
      field: 'total_oi',
      comment: 'Total open interest (calls + puts)'
    },
    callGamma: {
      type: DataTypes.DECIMAL(15, 8),
      field: 'call_gamma',
      comment: 'Aggregate call gamma'
    },
    putGamma: {
      type: DataTypes.DECIMAL(15, 8),
      field: 'put_gamma',
      comment: 'Aggregate put gamma'
    },
    spotPrice: {
      type: DataTypes.DECIMAL(12, 2),
      field: 'spot_price',
      comment: 'Spot price at snapshot time'
    },
    assetSymbol: {
      type: DataTypes.STRING(20),
      field: 'asset_symbol',
      defaultValue: 'BTCUSDT',
      comment: 'Asset symbol (for future multi-asset support)'
    }
  }, {
    tableName: 'gex_snapshots',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      {
        name: 'idx_timestamp',
        fields: ['timestamp']
      },
      {
        name: 'idx_strike',
        fields: ['strike']
      },
      {
        name: 'idx_timestamp_strike',
        fields: ['timestamp', 'strike']
      },
      {
        name: 'idx_asset_timestamp',
        fields: ['asset_symbol', 'timestamp']
      }
    ],
    comment: 'Historical GEX snapshots for heatmap visualization'
  });

  return GEXSnapshot;
};
