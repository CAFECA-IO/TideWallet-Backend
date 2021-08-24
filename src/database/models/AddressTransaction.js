module.exports = (sequelize, DataTypes) => sequelize.define('AddressTransaction', {
  // PK
  addressTransaction_id: {
    type: DataTypes.BIGINT,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false,
  },
  // FK
  currency_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  // FK
  accountAddress_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  // FK
  transaction_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  amount: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  direction: {
    type: DataTypes.SMALLINT,
    allowNull: false,
  },
  address: {
    type: DataTypes.STRING,
  },
}, {
  timestamps: false,
  tableName: 'AddressTransaction',
  charset: 'utf8',
  collate: 'utf8_unicode_ci',
  indexes: [
    { fields: ['currency_id'] },
    { fields: ['currency_id', 'address'] },
    { fields: ['currency_id', 'accountAddress_id'] },
  ],
});
