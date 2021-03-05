const EthParserBase = require('./EthParserBase');

class EthRopstenParser extends EthParserBase {
  constructor(config, database, logger) {
    super('8000025B', config, database, logger);

    this.options = config.blockchain.ethereum_ropsten;
  }
}

module.exports = EthRopstenParser;
