module.exports = (sequelize, DataTypes) => sequelize.define('BlockScanned', {
  // PK
  blockScanned_id: {
    type: DataTypes.BIGINT,
    autoIncrement: true,
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
  transaction_count: {
    type: DataTypes.INTEGER,
  },
  miner: {
    type: DataTypes.STRING,
  },
  difficulty: {
    type: DataTypes.STRING,
  },
  transactions_root: {
    type: DataTypes.STRING,
  },
  size: {
    type: DataTypes.BIGINT,
  },
  transaction_volume: {
    type: DataTypes.STRING,
  },
  gas_used: {
    type: DataTypes.BIGINT,
  },
  block_reward: {
    type: DataTypes.STRING,
  },
  block_fee: {
    type: DataTypes.STRING,
  },
  extra_data: {
    type: DataTypes.TEXT,
  },
  uncles: {
    type: DataTypes.STRING,
  },
}, {
  timestamps: false,
  tableName: 'BlockScanned',
  charset: 'utf8',
  collate: 'utf8_unicode_ci',
  indexes: [
    { fields: ['blockchain_id'] },
    { unique: true, fields: ['blockchain_id', 'block'] },
    { fields: ['blockchain_id', 'timestamp'] },
  ],
});
