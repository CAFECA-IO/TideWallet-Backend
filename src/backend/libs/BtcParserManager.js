const BtcParserManagerBase = require('./BtcParserManagerBase');

class BtcParserManager extends BtcParserManagerBase {
  constructor(config, database, logger) {
    super('80000000', config, database, logger);

    this.options = config.blockchain.bitcoin_mainnet;
  }

  async init() {
    await super.init();
  }
}

module.exports = BtcParserManager;
