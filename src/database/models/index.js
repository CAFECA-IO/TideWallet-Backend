const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');

const basename = path.basename(__filename);
const db = {};

const dbInstance = {};

const initialORM = async ({ database, logger = console }) => {
  if (!logger) logger = console;
  try {
    if (typeof dbInstance === 'object' && Object.keys(dbInstance).length > 0) {
      return dbInstance;
    }

    for (const dbConfig of Object.values(database)) {
      dbConfig.dialect = dbConfig.protocol;
      dbConfig.username = dbConfig.user;
      dbConfig.database = dbConfig.dbName;

      // init env.js for migration
      fs.writeFileSync(`env.${dbConfig.dbName}.js`, `
const env = {
  development: ${JSON.stringify(dbConfig)},
};

module.exports = env;
`);

      const sequelize = new Sequelize(dbConfig.dbName, dbConfig.user, dbConfig.password, dbConfig);
      fs.readdirSync(__dirname)
        .filter((file) => (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js'))
        .forEach((file) => {
          const modelPath = path.resolve(__dirname, file);
          // eslint-disable-next-line global-require, import/no-dynamic-require
          const myModel = require(modelPath)(sequelize, DataTypes);
          if (!db[dbConfig.dbName])db[dbConfig.dbName] = {};
          db[dbConfig.dbName][file.replace(/\.js/g, '')] = myModel;
        });

      // Account
      db[dbConfig.dbName].Account.belongsTo(db[dbConfig.dbName].User, { foreignKey: 'user_id' });
      db[dbConfig.dbName].User.hasMany(db[dbConfig.dbName].Account, { foreignKey: 'user_id' });
      // db[dbConfig.dbName].Account.belongsTo(db[dbConfig.dbName].Blockchain, { foreignKey: 'blockchain_id' });
      // db[dbConfig.dbName].Blockchain.hasOne(db[dbConfig.dbName].Account, { foreignKey: 'blockchain_id' });

      // AccountCurrency
      db[dbConfig.dbName].AccountCurrency.belongsTo(db[dbConfig.dbName].Account, { foreignKey: 'account_id' });
      db[dbConfig.dbName].Account.hasMany(db[dbConfig.dbName].AccountCurrency, { foreignKey: 'account_id' });
      // db[dbConfig.dbName].AccountCurrency.belongsTo(db[dbConfig.dbName].Currency, { foreignKey: 'currency_id' });
      // db[dbConfig.dbName].Currency.hasOne(db[dbConfig.dbName].AccountCurrency, { foreignKey: 'currency_id' });

      // AccountAddress
      db[dbConfig.dbName].AccountAddress.belongsTo(db[dbConfig.dbName].Account, { foreignKey: 'account_id' });
      db[dbConfig.dbName].Account.hasMany(db[dbConfig.dbName].AccountAddress, { foreignKey: 'account_id' });

      // BlockScanned
      db[dbConfig.dbName].BlockScanned.belongsTo(db[dbConfig.dbName].Blockchain, { foreignKey: 'blockchain_id' });
      db[dbConfig.dbName].Blockchain.hasMany(db[dbConfig.dbName].BlockScanned, { foreignKey: 'blockchain_id' });

      // Currency
      db[dbConfig.dbName].Currency.belongsTo(db[dbConfig.dbName].Blockchain, { foreignKey: 'blockchain_id' });
      db[dbConfig.dbName].Blockchain.hasOne(db[dbConfig.dbName].Currency, { foreignKey: 'blockchain_id' });

      // Device
      db[dbConfig.dbName].Device.belongsTo(db[dbConfig.dbName].User, { foreignKey: 'user_id' });
      db[dbConfig.dbName].User.hasMany(db[dbConfig.dbName].Device, { foreignKey: 'user_id' });

      // ThirdPartyLink
      db[dbConfig.dbName].ThirdPartyLink.belongsTo(db[dbConfig.dbName].User, { foreignKey: 'user_id' });
      db[dbConfig.dbName].User.hasMany(db[dbConfig.dbName].ThirdPartyLink, { foreignKey: 'user_id' });

      // Transaction
      db[dbConfig.dbName].Transaction.belongsTo(db[dbConfig.dbName].Currency, { foreignKey: 'currency_id' });
      db[dbConfig.dbName].Currency.hasMany(db[dbConfig.dbName].Transaction, { foreignKey: 'currency_id' });

      // AddressTransaction
      db[dbConfig.dbName].AddressTransaction.belongsTo(db[dbConfig.dbName].Currency, { foreignKey: 'currency_id' });
      db[dbConfig.dbName].Currency.hasMany(db[dbConfig.dbName].AddressTransaction, { foreignKey: 'currency_id' });
      db[dbConfig.dbName].AddressTransaction.belongsTo(db[dbConfig.dbName].AccountAddress, { foreignKey: 'accountAddress_id' });
      db[dbConfig.dbName].AccountAddress.hasMany(db[dbConfig.dbName].AddressTransaction, { foreignKey: 'accountAddress_id' });
      db[dbConfig.dbName].AddressTransaction.belongsTo(db[dbConfig.dbName].Transaction, { foreignKey: 'transaction_id' });
      db[dbConfig.dbName].Transaction.hasMany(db[dbConfig.dbName].AddressTransaction, { foreignKey: 'transaction_id' });

      // TokenTransaction
      db[dbConfig.dbName].TokenTransaction.belongsTo(db[dbConfig.dbName].Currency, { foreignKey: 'currency_id' });
      db[dbConfig.dbName].Currency.hasMany(db[dbConfig.dbName].TokenTransaction, { foreignKey: 'currency_id' });
      db[dbConfig.dbName].TokenTransaction.belongsTo(db[dbConfig.dbName].Transaction, { foreignKey: 'transaction_id' });
      db[dbConfig.dbName].Transaction.hasMany(db[dbConfig.dbName].TokenTransaction, { foreignKey: 'transaction_id' });

      // AddressTokenTransaction
      db[dbConfig.dbName].AddressTokenTransaction.belongsTo(db[dbConfig.dbName].Currency, { foreignKey: 'currency_id' });
      db[dbConfig.dbName].Currency.hasMany(db[dbConfig.dbName].AddressTokenTransaction, { foreignKey: 'currency_id' });
      db[dbConfig.dbName].AddressTokenTransaction.belongsTo(db[dbConfig.dbName].AccountAddress, { foreignKey: 'accountAddress_id' });
      db[dbConfig.dbName].AccountAddress.hasMany(db[dbConfig.dbName].AddressTokenTransaction, { foreignKey: 'accountAddress_id' });
      db[dbConfig.dbName].AddressTokenTransaction.belongsTo(db[dbConfig.dbName].TokenTransaction, { foreignKey: 'tokenTransaction_id' });
      db[dbConfig.dbName].TokenTransaction.hasMany(db[dbConfig.dbName].AddressTokenTransaction, { foreignKey: 'tokenTransaction_id' });

      // UTXO
      db[dbConfig.dbName].UTXO.belongsTo(db[dbConfig.dbName].Currency, { foreignKey: 'currency_id' });
      db[dbConfig.dbName].Currency.hasMany(db[dbConfig.dbName].UTXO, { foreignKey: 'currency_id' });
      db[dbConfig.dbName].UTXO.belongsTo(db[dbConfig.dbName].AccountAddress, { foreignKey: 'accountAddress_id' });
      db[dbConfig.dbName].AccountAddress.hasMany(db[dbConfig.dbName].UTXO, { foreignKey: 'accountAddress_id' });
      db[dbConfig.dbName].UTXO.belongsTo(db[dbConfig.dbName].Transaction, { foreignKey: 'transaction_id' });
      db[dbConfig.dbName].Transaction.hasMany(db[dbConfig.dbName].UTXO, { foreignKey: 'transaction_id' });
      db[dbConfig.dbName].UTXO.belongsTo(db[dbConfig.dbName].Transaction, { foreignKey: 'to_tx' });
      db[dbConfig.dbName].Transaction.hasMany(db[dbConfig.dbName].UTXO, { foreignKey: 'to_tx' });

      // TokenSecret
      db[dbConfig.dbName].TokenSecret.belongsTo(db[dbConfig.dbName].User, { foreignKey: 'user_id' });
      db[dbConfig.dbName].User.hasMany(db[dbConfig.dbName].TokenSecret, { foreignKey: 'user_id' });

      // FiatCurrencyRate
      db[dbConfig.dbName].FiatCurrencyRate.belongsTo(db[dbConfig.dbName].Currency, { foreignKey: 'currency_id' });
      db[dbConfig.dbName].Currency.hasMany(db[dbConfig.dbName].FiatCurrencyRate, { foreignKey: 'currency_id' });

      db[dbConfig.dbName].sequelize = sequelize;
      db[dbConfig.dbName].Sequelize = Sequelize;

      dbInstance[dbConfig.dbName] = await sequelize.sync({ logging: false }).then(() => {
      // eslint-disable-next-line no-console
        logger.log(`\x1b[1m\x1b[32mDB   \x1b[0m\x1b[21m ${dbConfig.dbName} connect success`);
        return db[dbConfig.dbName];
      });
    }

    return dbInstance;
  } catch (e) {
    // eslint-disable-next-line no-console
    logger.error('\x1b[1m\x1b[31mDB   \x1b[0m\x1b[21m \x1b[1m\x1b[31mconnect fails\x1b[0m\x1b[21m');
    throw e;
  }
};

module.exports = initialORM;
