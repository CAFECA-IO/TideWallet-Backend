const EthParserManagerBase = require('./EthParserManagerBase');

class EthRopstenParserManager extends EthParserManagerBase {
  constructor(config, database, logger) {
    super('F000003C', config, database, logger);

    this.options = config.blockchain.ethereum_mainnet;
  }

  async init() {
    await super.init();
  }
}

module.exports = EthRopstenParserManager;
