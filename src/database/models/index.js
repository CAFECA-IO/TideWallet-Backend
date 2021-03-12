const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');

const basename = path.basename(__filename);
const db = {};

let dbInstance;

function initialORM({ database, logger = console }) {
  if (!logger) logger = console;
  try {
    if (typeof dbInstance === 'object') {
      return dbInstance;
    }

    database.dialect = database.protocol;
    database.username = database.user;
    database.database = database.dbName;

    // init env.js for migration
    fs.writeFileSync('env.js', `
const env = {
  development: ${JSON.stringify(database)},
};

module.exports = env;
`);

    const sequelize = new Sequelize(database.dbName, database.user, database.password, database);
    fs.readdirSync(__dirname)
      .filter((file) => (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js'))
      .forEach((file) => {
        const modelPath = path.resolve(__dirname, file);
        // eslint-disable-next-line global-require, import/no-dynamic-require
        const myModel = require(modelPath)(sequelize, DataTypes);
        db[file.replace(/\.js/g, '')] = myModel;
      });

    // Account
    db.Account.belongsTo(db.User, { foreignKey: 'user_id' });
    db.User.hasMany(db.Account, { foreignKey: 'user_id' });
    db.Account.belongsTo(db.Blockchain, { foreignKey: 'blockchain_id' });
    db.Blockchain.hasOne(db.Account, { foreignKey: 'blockchain_id' });

    // AccountCurrency
    db.AccountCurrency.belongsTo(db.Account, { foreignKey: 'account_id' });
    db.Account.hasMany(db.AccountCurrency, { foreignKey: 'account_id' });
    db.AccountCurrency.belongsTo(db.Currency, { foreignKey: 'currency_id' });
    db.Currency.hasOne(db.AccountCurrency, { foreignKey: 'currency_id' });

    // AccountAddress
    db.AccountAddress.belongsTo(db.Account, { foreignKey: 'account_id' });
    db.Account.hasMany(db.AccountAddress, { foreignKey: 'account_id' });

    // BlockScanned
    db.BlockScanned.belongsTo(db.Blockchain, { foreignKey: 'blockchain_id' });
    db.Blockchain.hasMany(db.BlockScanned, { foreignKey: 'blockchain_id' });

    // Currency
    db.Currency.belongsTo(db.Blockchain, { foreignKey: 'blockchain_id' });
    db.Blockchain.hasOne(db.Currency, { foreignKey: 'blockchain_id' });

    // Device
    db.Device.belongsTo(db.User, { foreignKey: 'user_id' });
    db.User.hasMany(db.Device, { foreignKey: 'user_id' });

    // ThirdPartyLink
    db.ThirdPartyLink.belongsTo(db.User, { foreignKey: 'user_id' });
    db.User.hasMany(db.ThirdPartyLink, { foreignKey: 'user_id' });

    // Transaction
    db.Transaction.belongsTo(db.Currency, { foreignKey: 'currency_id' });
    db.Currency.hasMany(db.Transaction, { foreignKey: 'currency_id' });

    // AddressTransaction
    db.AddressTransaction.belongsTo(db.Currency, { foreignKey: 'currency_id' });
    db.Currency.hasMany(db.AddressTransaction, { foreignKey: 'currency_id' });
    db.AddressTransaction.belongsTo(db.AccountAddress, { foreignKey: 'accountAddress_id' });
    db.AccountAddress.hasMany(db.AddressTransaction, { foreignKey: 'accountAddress_id' });
    db.AddressTransaction.belongsTo(db.Transaction, { foreignKey: 'transaction_id' });
    db.Transaction.hasMany(db.AddressTransaction, { foreignKey: 'transaction_id' });

    // TokenTransaction
    db.TokenTransaction.belongsTo(db.Currency, { foreignKey: 'currency_id' });
    db.Currency.hasMany(db.TokenTransaction, { foreignKey: 'currency_id' });
    db.TokenTransaction.belongsTo(db.Transaction, { foreignKey: 'transaction_id' });
    db.Transaction.hasMany(db.TokenTransaction, { foreignKey: 'transaction_id' });

    // AddressTokenTransaction
    db.AddressTokenTransaction.belongsTo(db.Currency, { foreignKey: 'currency_id' });
    db.Currency.hasMany(db.AddressTokenTransaction, { foreignKey: 'currency_id' });
    db.AddressTokenTransaction.belongsTo(db.AccountAddress, { foreignKey: 'accountAddress_id' });
    db.AccountAddress.hasMany(db.AddressTokenTransaction, { foreignKey: 'accountAddress_id' });
    db.AddressTokenTransaction.belongsTo(db.TokenTransaction, { foreignKey: 'tokenTransaction_id' });
    db.TokenTransaction.hasMany(db.AddressTokenTransaction, { foreignKey: 'tokenTransaction_id' });

    // UTXO
    db.UTXO.belongsTo(db.Currency, { foreignKey: 'currency_id' });
    db.Currency.hasMany(db.UTXO, { foreignKey: 'currency_id' });
    db.UTXO.belongsTo(db.AccountAddress, { foreignKey: 'accountAddress_id' });
    db.AccountAddress.hasMany(db.UTXO, { foreignKey: 'accountAddress_id' });
    db.UTXO.belongsTo(db.Transaction, { foreignKey: 'transaction_id' });
    db.Transaction.hasMany(db.UTXO, { foreignKey: 'transaction_id' });
    db.UTXO.belongsTo(db.Transaction, { foreignKey: 'to_tx' });
    db.Transaction.hasMany(db.UTXO, { foreignKey: 'to_tx' });

    // TokenSecret
    db.TokenSecret.belongsTo(db.User, { foreignKey: 'user_id' });
    db.User.hasMany(db.TokenSecret, { foreignKey: 'user_id' });

    // FiatCurrencyRate
    db.FiatCurrencyRate.belongsTo(db.Currency, { foreignKey: 'currency_id' });
    db.Currency.hasMany(db.FiatCurrencyRate, { foreignKey: 'currency_id' });

    db.sequelize = sequelize;
    db.Sequelize = Sequelize;

    dbInstance = sequelize.sync({ logging: false }).then(() => {
      // eslint-disable-next-line no-console
      logger.log('\x1b[1m\x1b[32mDB   \x1b[0m\x1b[21m connect success');
      return db;
    });

    return dbInstance;
  } catch (e) {
    // eslint-disable-next-line no-console
    logger.error('\x1b[1m\x1b[31mDB   \x1b[0m\x1b[21m \x1b[1m\x1b[31mconnect fails\x1b[0m\x1b[21m');
    throw e;
  }
}

module.exports = initialORM;
