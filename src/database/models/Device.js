module.exports = (sequelize, DataTypes) => sequelize.define('Device', {
  // PK
  Device_id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
  },
  // FK
  User_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  install_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  timestamp: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  app_uuid: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  timestamps: false,
  tableName: 'Device',
  charset: 'utf8',
  collate: 'utf8_unicode_ci',
});
