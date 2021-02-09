module.exports = (sequelize, DataTypes) => sequelize.define('AddressTokenTransaction', {
  // PK
  AddressTokenTransaction_id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
  },
  // FK
  Currency_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  // FK
  AccountAddress_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  // FK
  TokenTransaction_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  direction: {
    type: DataTypes.SMALLINT,
    allowNull: false,
  },
}, {
  timestamps: false,
  tableName: 'AddressTokenTransaction',
  charset: 'utf8',
  collate: 'utf8_unicode_ci',
  indexes: [{ fields: ['Currency_id'] }],
});
