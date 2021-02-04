module.exports = (sequelize, DataTypes) => sequelize.define('AccountCurrency', {
  // PK
  AccountCurrency_id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
  },
  // FK
  Account_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  // FK
  Currency_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  balance: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: '0',
  },
  number_of_external_key: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  number_of_internal_key: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
}, {
  timestamps: false,
  tableName: 'AccountCurrency',
  charset: 'utf8',
  collate: 'utf8_unicode_ci',
});
