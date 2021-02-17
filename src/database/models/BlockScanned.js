module.exports = (sequelize, DataTypes) => sequelize.define('BlockScanned', {
  // PK
  BlockScanned_id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
  },
  // FK
  Blockchain_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  start_block: {
    type: DataTypes.INTEGER,
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
  indexes: [{ fields: ['Blockchain_id'] }],
});
