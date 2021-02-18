module.exports = (sequelize, DataTypes) => sequelize.define('AccountAddress', {
  // PK
  accountAddress_id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
  },
  // FK
  account_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  chain_index: {
    type: DataTypes.SMALLINT,
    allowNull: false,
    defaultValue: 0,
  },
  key_index: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  public_key: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  address: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  timestamps: false,
  tableName: 'AccountAddress',
  charset: 'utf8',
  collate: 'utf8_unicode_ci',
});
