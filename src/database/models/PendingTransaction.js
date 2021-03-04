module.exports = (sequelize, DataTypes) => sequelize.define('PendingTransaction', {
  // PK
  pendingTransaction_id: {
    type: DataTypes.BIGINT,
    unique: true,
    primaryKey: true,
    autoIncrement: true,
  },
  // FK
  blockchain_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  transactions: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  timestamp: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  timestamps: false,
  tableName: 'PendingTransaction',
  charset: 'utf8',
  collate: 'utf8_unicode_ci',
});
