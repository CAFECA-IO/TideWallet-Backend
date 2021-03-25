const EthParserManagerBase = require('./EthParserManagerBase');

class EthParserManager extends EthParserManagerBase {
  constructor(config, database, logger) {
    super('8000003C', config, database, logger);

    this.options = config.blockchain.ethereum_mainnet;
  }

  async init() {
    await super.init();
  }
}

module.exports = EthParserManager;
