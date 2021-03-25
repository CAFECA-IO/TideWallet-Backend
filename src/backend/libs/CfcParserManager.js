const EthParserManagerBase = require('./EthParserManagerBase');

class CfcParserManager extends EthParserManagerBase {
  constructor(config, database, logger) {
    super('80000CFC', config, database, logger);

    this.options = config.blockchain.ethereum_mainnet;
  }

  async init() {
    await super.init();
  }
}

module.exports = CfcParserManager;
