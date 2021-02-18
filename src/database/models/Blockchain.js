module.exports = (sequelize, DataTypes) => sequelize.define('Blockchain', {
  // PK
  blockchain_id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  coin_type: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  network_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  publish: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
  },
  block: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  start_block: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  bip32_public: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  bip32_private: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  pubKeyHash: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  scriptHash: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  wif: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  avg_fee: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: '0',
  },
}, {
  timestamps: false,
  tableName: 'Blockchain',
  charset: 'utf8',
  collate: 'utf8_unicode_ci',
});
