module.exports = (sequelize, DataTypes) => sequelize.define('OAuthRefreshToken', {
  Refresh_token: {
    type: DataTypes.STRING(256),
    allowNull: false,
    primaryKey: true,
  },
  User_id: {
    type: DataTypes.STRING,
    allowNull: false,
    primaryKey: true,
  },
  expire_time: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  timestamps: false,
  tableName: 'OAuthRefreshToken',
  charset: 'utf8',
  collate: 'utf8_unicode_ci',
});
