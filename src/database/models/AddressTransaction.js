module.exports = (sequelize, DataTypes) => sequelize.define('AddressTransaction', {
  // PK
  AddressTransaction_id: {
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
  Transaction_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  direction: {
    type: DataTypes.SMALLINT,
    allowNull: false,
  },
}, {
  timestamps: false,
  tableName: 'AddressTransaction',
  charset: 'utf8',
  collate: 'utf8_unicode_ci',
  indexes: [{ unique: true, fields: ['Currency_id'] }],
});
