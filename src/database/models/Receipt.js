module.exports = (sequelize, DataTypes) => sequelize.define('Receipt', {
  // PK
  receipt_id: {
    type: DataTypes.BIGINT,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false,
  },
  // FK
  transaction_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  // FK
  currency_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  contract_address: {
    type: DataTypes.STRING,
  },
  cumulative_gas_used: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  gas_used: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  logs: {
    type: DataTypes.TEXT,
  },
  logsBloom: {
    type: DataTypes.TEXT,
  },
  status: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  timestamps: false,
  tableName: 'Receipt',
  charset: 'utf8',
  collate: 'utf8_unicode_ci',
});
