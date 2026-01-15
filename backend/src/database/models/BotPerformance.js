const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BotPerformance = sequelize.define('BotPerformance', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      comment: 'Unique performance record identifier'
    },
    botId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'bot_id',
      comment: 'Bot instance identifier (null for aggregated metrics)'
    },
    period: {
      type: DataTypes.ENUM('daily', 'weekly', 'monthly', 'all_time'),
      allowNull: false,
      comment: 'Performance period'
    },
    periodStart: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'period_start',
      comment: 'Period start date (null for all_time)'
    },
    periodEnd: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'period_end',
      comment: 'Period end date (null for all_time)'
    },
    strategy: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Strategy filter (null for all strategies)'
    },
    totalTrades: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'total_trades',
      comment: 'Total number of trades'
    },
    winningTrades: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'winning_trades',
      comment: 'Number of winning trades'
    },
    losingTrades: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'losing_trades',
      comment: 'Number of losing trades'
    },
    winRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      field: 'win_rate',
      comment: 'Win rate percentage (0-100)'
    },
    totalPnl: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      field: 'total_pnl',
      comment: 'Total profit/loss'
    },
    avgPnlPerTrade: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'avg_pnl_per_trade',
      comment: 'Average P&L per trade'
    },
    avgWinningTrade: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'avg_winning_trade',
      comment: 'Average winning trade P&L'
    },
    avgLosingTrade: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'avg_losing_trade',
      comment: 'Average losing trade P&L'
    },
    largestWin: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'largest_win',
      comment: 'Largest winning trade'
    },
    largestLoss: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'largest_loss',
      comment: 'Largest losing trade'
    },
    maxDrawdown: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'max_drawdown',
      comment: 'Maximum drawdown'
    },
    profitFactor: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      field: 'profit_factor',
      comment: 'Gross profit / Gross loss'
    },
    sharpeRatio: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      field: 'sharpe_ratio',
      comment: 'Risk-adjusted return metric'
    },
    avgDaysInTrade: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      field: 'avg_days_in_trade',
      comment: 'Average number of days per trade'
    }
  }, {
    tableName: 'bot_performance',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['bot_id'] },
      { fields: ['period'] },
      { fields: ['strategy'] },
      { fields: ['period_start', 'period_end'] },
      { fields: ['created_at'] }
    ]
  });

  BotPerformance.associate = (models) => {
    // No associations needed for now
  };

  return BotPerformance;
};
