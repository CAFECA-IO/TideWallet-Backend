const EthParserBase = require('./EthParserBase');

class EthParser extends EthParserBase {
  constructor(config, database, logger) {
    super('8000003C', config, database, logger);

    this.options = config.blockchain.ethereum_mainnet;
  }
}

module.exports = EthParser;
