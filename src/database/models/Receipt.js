module.exports = (sequelize, DataTypes) => sequelize.define('Receipt', {
  // PK
  receipt_id: {
    type: DataTypes.BIGINT,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false,
  },
  // UK
  transaction_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
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
  indexes: [
    { unique: true, fields: ['transaction_id'] },
    { unique: true, fields: ['currency_id', 'transaction_id'] },
  ],
});
