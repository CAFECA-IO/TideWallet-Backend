const BchParserManagerBase = require('./BchParserManagerBase');

class BchTestnetParserManager extends BchParserManagerBase {
  constructor(config, database, logger) {
    super('F0000091', config, database, logger);

    this.options = config.blockchain.bitcoin_cash_testnet;
  }

  async init() {
    await super.init();
  }
}

module.exports = BchTestnetParserManager;
