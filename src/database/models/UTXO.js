module.exports = (sequelize, DataTypes) => sequelize.define('UTXO', {
  // PK
  utxo_id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
  },
  // FK
  currency_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  // FK
  accountAddress_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  // FK
  transaction_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  // FK
  to_tx: {
    type: DataTypes.BIGINT,
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
    type: DataTypes.STRING,
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
  indexes: [{ fields: ['currency_id'] }],
});
