module.exports = (sequelize, DataTypes) => sequelize.define('UserApp', {
  // PK
  user_app_id: {
    type: DataTypes.BIGINT,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false,
  },
  // apple / android id
  app_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  app_user_id: {
    type: DataTypes.STRING(24),
    allowNull: false,
  },
  app_user_secret: {
    type: DataTypes.STRING(24),
    allowNull: false,
  },
}, {
  timestamps: false,
  tableName: 'UserApp',
  charset: 'utf8',
  collate: 'utf8_unicode_ci',
  indexes: [{ unique: true, fields: ['app_id'] }],
});
