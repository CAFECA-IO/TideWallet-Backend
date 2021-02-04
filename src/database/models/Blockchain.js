module.exports = (sequelize, DataTypes) => sequelize.define('Blockchain', {
  // PK
  Blockchain_id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  coin_type: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  network_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  publish: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
  },
  block: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  timestamps: false,
  tableName: 'Blockchain',
  charset: 'utf8',
  collate: 'utf8_unicode_ci',
});
