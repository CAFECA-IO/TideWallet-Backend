const BtcParserManagerBase = require('./BtcParserManagerBase');

class BtcTestnetParserManager extends BtcParserManagerBase {
  constructor(config, database, logger) {
    super('F0000000', config, database, logger);

    this.options = config.blockchain.bitcoin_testnet;
  }

  async init() {
    await super.init();
  }
}

module.exports = BtcTestnetParserManager;
