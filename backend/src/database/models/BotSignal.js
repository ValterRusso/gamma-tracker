const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BotSignal = sequelize.define('BotSignal', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      comment: 'Unique signal identifier'
    },
    botId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'bot_id',
      comment: 'Bot instance identifier (format: strategy_timestamp_random)'
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Signal generation timestamp'
    },
    signalType: {
      type: DataTypes.ENUM('entry', 'exit', 'wait', 'error'),
      allowNull: false,
      field: 'signal_type',
      comment: 'Type of signal generated'
    },
    strategy: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Strategy recommended (if entry signal)'
    },
    confidence: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
      comment: 'Signal confidence (0.00 to 1.00)'
    },
    marketData: {
      type: DataTypes.JSON,
      allowNull: false,
      field: 'market_data',
      comment: 'Market data snapshot (spot, IV rank, Greeks, volume, etc.)'
    },
    actionTaken: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'action_taken',
      comment: 'Whether action was taken based on this signal'
    },
    tradeId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'trade_id',
      comment: 'Associated trade ID (if action was taken)'
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Detailed reason for signal or why action was/wasn\'t taken'
    }
  }, {
    tableName: 'bot_signals',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { fields: ['bot_id'] },
      { fields: ['timestamp'] },
      { fields: ['signal_type'] },
      { fields: ['strategy'] },
      { fields: ['action_taken'] },
      { fields: ['trade_id'] },
      { fields: ['created_at'] }
    ]
  });

  BotSignal.associate = (models) => {
    // Future: associate with BotTrade
  };

  return BotSignal;
};
