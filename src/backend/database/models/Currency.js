module.exports = (sequelize, DataTypes) => sequelize.define('Currency', {
  // PK
  Currency_id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
  },
  // FK
  Blockchain_id: {
    type: DataTypes.STRING,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  symbol: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  type: {
    type: DataTypes.SMALLINT,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
  },
  publish_time: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  address: {
    type: DataTypes.STRING,
  },
  decimals: {
    type: DataTypes.SMALLINT,
  },
  total_supply: {
    type: DataTypes.STRING,
  },
  exchange_rate: {
    type: DataTypes.STRING,
  },
  contract: {
    type: DataTypes.TEXT,
  },
}, {
  timestamps: false,
  tableName: 'Currency',
  charset: 'utf8',
  collate: 'utf8_unicode_ci',
});
