module.exports = (sequelize, DataTypes) => sequelize.define('Transaction', {
  // PK
  transaction_id: {
    type: DataTypes.BIGINT,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false,
  },
  // FK
  currency_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  txid: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  timestamp: {
    type: DataTypes.INTEGER,
  },
  source_addresses: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  destination_addresses: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  amount: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  fee: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  note: {
    type: DataTypes.TEXT,
  },
  block: {
    type: DataTypes.INTEGER,
  },
  nonce: {
    type: DataTypes.INTEGER,
  },
  gas_price: {
    type: DataTypes.STRING,
  },
  gas_used: {
    type: DataTypes.INTEGER,
  },
  result: {
    type: DataTypes.BOOLEAN,
  },
}, {
  timestamps: false,
  tableName: 'Transaction',
  charset: 'utf8',
  collate: 'utf8_unicode_ci',
  indexes: [
    { fields: ['currency_id'] },
    {
      unique: true,
      fields: ['txid'],
    },
  ],
});
