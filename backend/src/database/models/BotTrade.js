const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BotTrade = sequelize.define('BotTrade', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      comment: 'Unique trade identifier'
    },
    botId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'bot_id',
      comment: 'Bot instance identifier (format: strategy_timestamp_random)'
    },
    strategy: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Strategy name (iron_condor, strangle, butterfly, etc.)'
    },
    status: {
      type: DataTypes.ENUM('active', 'closed', 'cancelled'),
      defaultValue: 'active',
      allowNull: false,
      comment: 'Trade status'
    },
    entryTime: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'entry_time',
      comment: 'Trade entry timestamp'
    },
    exitTime: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'exit_time',
      comment: 'Trade exit timestamp'
    },
    entrySpot: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'entry_spot',
      comment: 'Spot price at entry'
    },
    exitSpot: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'exit_spot',
      comment: 'Spot price at exit'
    },
    entryIvRank: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      field: 'entry_iv_rank',
      comment: 'IV Rank at entry (0-100)'
    },
    exitIvRank: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      field: 'exit_iv_rank',
      comment: 'IV Rank at exit (0-100)'
    },
    maxProfit: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'max_profit',
      comment: 'Maximum possible profit'
    },
    maxLoss: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'max_loss',
      comment: 'Maximum possible loss'
    },
    entryCredit: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'entry_credit',
      comment: 'Credit received at entry (for credit spreads)'
    },
    exitCost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'exit_cost',
      comment: 'Cost to close position'
    },
    currentValue: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'current_value',
      comment: 'Current value of the position (updated in real-time)'
    },
    unrealizedPnl: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'unrealized_pnl',
      comment: 'Unrealized profit/loss (updated in real-time)'
    },
    currentPnlPercent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      field: 'current_pnl_percent',
      comment: 'Current P&L as percentage (updated in real-time)'
    },
    realizedPnl: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'realized_pnl',
      comment: 'Realized profit/loss'
    },
    pnlPercent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      field: 'pnl_percent',
      comment: 'P&L as percentage of max risk'
    },
    exitReason: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'exit_reason',
      comment: 'Reason for exit (profit_target, stop_loss, dte_exit, etc.)'
    },
    legs: {
      type: DataTypes.JSON,
      allowNull: false,
      comment: 'Array of option legs with entry/exit details'
    },
    entryGreeks: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'entry_greeks',
      comment: 'Position Greeks at entry (delta, gamma, theta, vega)'
    },
    exitGreeks: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'exit_greeks',
      comment: 'Position Greeks at exit'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Additional notes or observations'
    }
  }, {
    tableName: 'bot_trades',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['bot_id'] },
      { fields: ['strategy'] },
      { fields: ['status'] },
      { fields: ['entry_time'] },
      { fields: ['exit_time'] },
      { fields: ['created_at'] }
    ]
  });

  BotTrade.associate = (models) => {
    // Future: associate with BotConfig if needed
  };

  return BotTrade;
};
