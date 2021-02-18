module.exports = (sequelize, DataTypes) => sequelize.define('BlockScanned', {
  // PK
  blockScanned_id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
  },
  // FK
  blockchain_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  block: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  block_hash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  timestamp: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  result: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
}, {
  timestamps: false,
  tableName: 'BlockScanned',
  charset: 'utf8',
  collate: 'utf8_unicode_ci',
  indexes: [{ fields: ['blockchain_id'] }],
});
