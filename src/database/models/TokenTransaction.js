module.exports = (sequelize, DataTypes) => sequelize.define('TokenTransaction', {
  // PK
  TokenTransaction_id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
  },
  // FK
  Transaction_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  // FK
  Currency_id: {
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
  indexes: [{ unique: true, fields: ['Currency_id'] }],
});
