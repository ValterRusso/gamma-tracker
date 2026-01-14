const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BotConfig = sequelize.define('BotConfig', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      comment: 'Unique config identifier'
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Config name for identification'
    },
    strategy: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Strategy type (iron_condor, strangle, etc.)'
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Whether this config is active'
    },
    entryRules: {
      type: DataTypes.JSON,
      allowNull: false,
      field: 'entry_rules',
      comment: 'Entry conditions (IV rank, DTE, deltas, etc.)'
    },
    exitRules: {
      type: DataTypes.JSON,
      allowNull: false,
      field: 'exit_rules',
      comment: 'Exit conditions (profit target, stop loss, DTE, delta threshold)'
    },
    riskParams: {
      type: DataTypes.JSON,
      allowNull: false,
      field: 'risk_params',
      comment: 'Risk parameters (max risk, position size, max positions)'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Strategy description and notes'
    }
  }, {
    tableName: 'bot_configs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['strategy'] },
      { fields: ['enabled'] },
      { fields: ['created_at'] }
    ]
  });

  BotConfig.associate = (models) => {
    // Future: associate with BotTrade if needed
  };

  return BotConfig;
};
