module.exports = (sequelize, DataTypes) => sequelize.define('ThirdPartyLink', {
  // PK
  ThirdPartyLink_id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
  },
  // FK
  User_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  third_party_account: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  info: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
}, {
  timestamps: false,
  tableName: 'ThirdPartyLink',
  charset: 'utf8',
  collate: 'utf8_unicode_ci',
});
