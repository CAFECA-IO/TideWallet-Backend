module.exports = (sequelize, DataTypes) => sequelize.define('TokenTransaction', {
  // PK
  tokenTransaction_id: {
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
  txid: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  timestamp: {
    type: DataTypes.INTEGER,
    allowNull: false,
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
  result: {
    type: DataTypes.BOOLEAN,
  },
}, {
  timestamps: false,
  tableName: 'TokenTransaction',
  charset: 'utf8',
  collate: 'utf8_unicode_ci',
  indexes: [
    { fields: ['currency_id'] },
    {
      unique: true,
      fields: ['currency_id', 'transaction_id'],
    },
  ],
});
