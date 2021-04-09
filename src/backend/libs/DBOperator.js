const Utils = require('./Utils');
const ResponseFormat = require('./ResponseFormat');
const Codes = require('./Codes');

class DBOperator {
  constructor(config, database, logger) {
    this.config = config;
    this.database = database;
    this.logger = logger;
  }

  updateDBInstance(dbInstance, options) {
    if (options.include && options.include.length > 0) {
      options.include.forEach((item, i) => {
        const _include = { ...item };
        _include.model = dbInstance[_include._model];
        options.include[i] = _include;
      });
    }
    return options;
  }

  async findAll(myOptions) {
    try {
      const { tableName, options = {} } = myOptions;

      if (!tableName) return new ResponseFormat({ message: 'db error(query need table name)', code: Codes.DB_ERROR });
      const queries = [];
      Utils.databaseInstanceName.forEach((dbName) => {
        const _options = this.updateDBInstance(this.database.db[dbName], options);
        queries.push(this.database.db[dbName][tableName].findAll(_options));
      });
      const findItems = await Promise.all(queries).catch((error) => new ResponseFormat({ message: `db error(${error})`, code: Codes.DB_ERROR }));
      if (findItems.code === Codes.DB_ERROR) throw findItems;

      return findItems.concat.apply([], findItems);
    } catch (e) {
      this.logger.error(`findAll options: (${JSON.stringify(myOptions)}) error:`, e);
      throw e;
    }
  }

  async findOne(myOptions) {
    try {
      const { tableName, options = {} } = myOptions;

      if (!tableName) return new ResponseFormat({ message: 'db error(query need table name)', code: Codes.DB_ERROR });
      const queries = [];
      Utils.databaseInstanceName.forEach((dbName) => {
        queries.push(this.database.db[dbName][tableName].findOne(options));
      });
      const findItems = await Promise.all(queries).catch((error) => new ResponseFormat({ message: `db error(${error})`, code: Codes.DB_ERROR }));
      if (findItems.code === Codes.DB_ERROR) throw findItems;

      return findItems.find((item) => item !== null);
    } catch (e) {
      this.logger.error(`findAll options: (${JSON.stringify(myOptions)}) error:`, e);
      throw e;
    }
  }
}

module.exports = DBOperator;
