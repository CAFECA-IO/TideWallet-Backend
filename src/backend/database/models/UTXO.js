module.exports = (sequelize, DataTypes) => sequelize.define('UTXO', {
  // PK
  UTXO_id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
  },
  // FK
  Currency_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  // FK
  AccountAddress_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  // FK
  Transaction_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  // FK
  to_tx: {
    type: DataTypes.STRING,
  },
  txid: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  vout: {
    type: DataTypes.SMALLINT,
    allowNull: false,
  },
  type: {
    type: DataTypes.SMALLINT,
    allowNull: false,
  },
  amount: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  script: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  locktime: {
    type: DataTypes.INTEGER,
  },
  on_block_timestamp: {
    type: DataTypes.INTEGER,
  },
}, {
  timestamps: false,
  tableName: 'UTXO',
  charset: 'utf8',
  collate: 'utf8_unicode_ci',
  indexes: [{ unique: true, fields: ['Currency_id'] }],
});
