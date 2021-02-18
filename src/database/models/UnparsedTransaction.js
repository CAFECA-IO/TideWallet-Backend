module.exports = (sequelize, DataTypes) => sequelize.define('UnparsedTransaction', {
  // PK
  unparsedTransaction_id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
  },
  // FK
  blockchain_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  txid: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  transaction: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  receipt: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  timestamp: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  timestamps: false,
  tableName: 'UnparsedTransaction',
  charset: 'utf8',
  collate: 'utf8_unicode_ci',
});
