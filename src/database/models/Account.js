module.exports = (sequelize, DataTypes) => sequelize.define('Account', {
  // PK
  Account_id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
  },
  // FK
  User_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  // FK
  Blockchain_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  purpose: {
    type: DataTypes.SMALLINT,
    allowNull: false,
  },
  curve_type: {
    type: DataTypes.SMALLINT,
    allowNull: false,
  },
  extend_public_key: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  regist_block_num: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  timestamps: false,
  tableName: 'Account',
  charset: 'utf8',
  collate: 'utf8_unicode_ci',
});
