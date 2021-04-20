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
      for (let i = 0; i < options.include.length; i++) {
        const _include = { ...options.include[i] };
        _include.model = dbInstance[_include._model];
        options.include[i] = _include;

        // TODO: refactor it
        if (_include.include && _include.include.length > 0) {
          for (let j = 0; j < _include.include.length; j++) {
            const _include2 = { ..._include.include[i] };
            _include2.model = dbInstance[_include2._model];
            options.include[i].include[j] = _include2;
          }
        }
      }
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
        const _options = this.updateDBInstance(this.database.db[dbName], { ...options });
        queries.push(this.database.db[dbName][tableName].findOne(_options));
      });
      const findItems = await Promise.all(queries).catch((error) => new ResponseFormat({ message: `db error(${error})`, code: Codes.DB_ERROR }));
      if (findItems.code === Codes.DB_ERROR) throw findItems;

      return findItems.find((item) => item !== null);
    } catch (e) {
      this.logger.error(`findOne options: (${JSON.stringify(myOptions)}) error:`, e);
      throw e;
    }
  }
}

module.exports = DBOperator;
