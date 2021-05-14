const EthParserManagerBase = require('./EthParserManagerBase');

class TtnParserManager extends EthParserManagerBase {
  constructor(config, database, logger) {
    super('80001F51', config, database, logger);

    this.options = config.blockchain.titan;
    this.syncInterval = config.syncInterval.titan ? config.syncInterval.titan : 1500;
  }

  async init() {
    await super.init();
  }
}

module.exports = TtnParserManager;
