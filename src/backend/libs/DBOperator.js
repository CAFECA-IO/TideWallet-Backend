const Utils = require('./Utils');
const ResponseFormat = require('./ResponseFormat');
const Codes = require('./Codes');

class DBOperator {
  constructor(config, database, logger) {
    this.config = config;
    this.database = database;
    this.logger = logger;
  }

  async findAll(myOptions) {
    try {
      const { tableName, options = {} } = myOptions;

      if (!tableName) return new ResponseFormat({ message: 'db error(query need table name)', code: Codes.DB_ERROR });
      const queries = [];
      Utils.databaseInstanceName.forEach((dbName) => {
        queries.push(this.database.db[dbName][tableName].findAll(options));
      });
      const tokenInfoFromPeer = await Promise.all(queries).catch((error) => new ResponseFormat({ message: `rpc error(${error})`, code: Codes.RPC_ERROR }));
      if (tokenInfoFromPeer.code === Codes.RPC_ERROR) return tokenInfoFromPeer;

      return tokenInfoFromPeer.concat.apply([], tokenInfoFromPeer);
    } catch (e) {
      this.logger.log(`findAll options: (${JSON.stringify(myOptions)}) error:`, e);
      return e;
    }
  }
}

module.exports = DBOperator;
