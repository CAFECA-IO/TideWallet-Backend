const BchParserManagerBase = require('./BchParserManagerBase');

class BchParserManager extends BchParserManagerBase {
  constructor(config, database, logger) {
    super('80000091', config, database, logger);

    this.options = config.blockchain.bitcoin_cash_mainnet;
  }

  async init() {
    await super.init();
  }
}

module.exports = BchParserManager;
