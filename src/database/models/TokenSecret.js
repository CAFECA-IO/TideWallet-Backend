module.exports = (sequelize, DataTypes) => sequelize.define('TokenSecret', {
  tokenSecret: {
    type: DataTypes.STRING(256),
    allowNull: false,
    primaryKey: true,
  },
  user_id: {
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
  tableName: 'TokenSecret',
  charset: 'utf8',
  collate: 'utf8_unicode_ci',
});
