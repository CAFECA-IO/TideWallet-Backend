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
    db.User.hasMany(db.Account, { foreignKey: 'User_id' });
    db.Blockchain.hasOne(db.Account, { foreignKey: 'Blockchain_id' });
    // AccountCurrency
    db.Account.hasMany(db.AccountCurrency, { foreignKey: 'Account_id' });
    db.Currency.hasOne(db.AccountCurrency, { foreignKey: 'Currency_id' });
    // AccountAddress
    db.Account.hasMany(db.AccountAddress, { foreignKey: 'Account_id' });
    // BlockScanned
    db.Blockchain.hasMany(db.BlockScanned, { foreignKey: 'Blockchain_id' });
    // Currency
    db.Blockchain.hasOne(db.Currency, { foreignKey: 'Blockchain_id' });
    // Device
    db.User.hasMany(db.Device, { foreignKey: 'User_id' });
    // ThirdPartyLink
    db.User.hasMany(db.ThirdPartyLink, { foreignKey: 'User_id' });
    // Transaction
    db.Currency.hasMany(db.Transaction, { foreignKey: 'Currency_id' });
    // AddressTransaction
    db.Currency.hasMany(db.AddressTransaction, { foreignKey: 'Currency_id' });
    db.AccountAddress.hasMany(db.AddressTransaction, { foreignKey: 'AccountAddress_id' });
    db.Transaction.hasMany(db.AddressTransaction, { foreignKey: 'Transaction_id' });
    // TokenTransaction
    db.Currency.hasMany(db.TokenTransaction, { foreignKey: 'Currency_id' });
    db.Transaction.hasMany(db.TokenTransaction, { foreignKey: 'Transaction_id' });
    // AddressTokenTransaction
    db.Currency.hasMany(db.AddressTokenTransaction, { foreignKey: 'Currency_id' });
    db.AccountAddress.hasMany(db.AddressTokenTransaction, { foreignKey: 'AccountAddress_id' });
    db.TokenTransaction.hasMany(db.AddressTokenTransaction, { foreignKey: 'TokenTransaction_id' });
    // UTXO
    db.Currency.hasMany(db.UTXO, { foreignKey: 'Currency_id' });
    db.AccountAddress.hasMany(db.UTXO, { foreignKey: 'AccountAddress_id' });
    db.Transaction.hasMany(db.UTXO, { foreignKey: 'Transaction_id' });
    db.Transaction.hasMany(db.UTXO, { foreignKey: 'to_tx' });

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
