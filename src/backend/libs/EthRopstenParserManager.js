const EthParserManagerBase = require('./EthParserManagerBase');

class EthRopstenParserManager extends EthParserManagerBase {
  constructor(config, database, logger) {
    super('8000025B', config, database, logger);

    this.options = config.blockchain.ethereum_mainnet;
  }

  async init() {
    await super.init();
  }
}

module.exports = EthRopstenParserManager;
