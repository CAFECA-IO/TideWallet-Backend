module.exports = (sequelize, DataTypes) => sequelize.define('ParseBack', {
  // PK
  parseBack_id: {
    type: DataTypes.BIGINT,
    unique: true,
    primaryKey: true,
    autoIncrement: true,
  },
  blockchain_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  block: {
    type: DataTypes.INTEGER,
  },
  done: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  retry: {
    type: DataTypes.INTEGER,
  },
}, {
  timestamps: false,
  tableName: 'ParseBack',
  charset: 'utf8',
  collate: 'utf8_unicode_ci',
  indexes: [
    { fields: ['block'] },
  ],
});
