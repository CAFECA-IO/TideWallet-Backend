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
