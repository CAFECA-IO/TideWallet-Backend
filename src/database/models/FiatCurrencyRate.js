module.exports = (sequelize, DataTypes) => sequelize.define('FiatCurrencyRate', {
  // PK
  fiatCurrencyRate_id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
  },
  // FK
  currency_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  rate: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  timestamps: false,
  tableName: 'FiatCurrencyRate',
  charset: 'utf8',
  collate: 'utf8_unicode_ci',
  indexes: [
    {
      unique: true,
      fields: ['currency_id'],
    },
  ],
});
