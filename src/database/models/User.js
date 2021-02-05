module.exports = (sequelize, DataTypes) => sequelize.define('User', {
  // PK
  User_id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
  },
  keystore: {
    type: DataTypes.TEXT,
  },
  private_key: {
    type: DataTypes.STRING,
  },
  last_login_timestamp: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  timestamps: false,
  tableName: 'User',
  charset: 'utf8',
  collate: 'utf8_unicode_ci',
});
