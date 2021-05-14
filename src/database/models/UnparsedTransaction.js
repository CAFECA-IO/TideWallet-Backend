module.exports = (sequelize, DataTypes) => sequelize.define('UnparsedTransaction', {
  // PK
  unparsedTransaction_id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
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
  retry: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  last_retry: {
    type: DataTypes.INTEGER,
  },
}, {
  timestamps: false,
  tableName: 'UnparsedTransaction',
  charset: 'utf8',
  collate: 'utf8_unicode_ci',
  indexes: [
    { unique: true, fields: ['txid'] },
    { unique: false, fields: ['blockchain_id', 'timestamp'] },
  ],
});
