module.exports = (sequelize, DataTypes) => sequelize.define('code', {
  // PK
  code_id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
  },
  table: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  column: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  code: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  timestamps: false,
  tableName: 'code',
  charset: 'utf8',
  collate: 'utf8_unicode_ci',
});
