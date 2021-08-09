const EthParserBase = require('./EthParserBase');

class EthRopstenParser extends EthParserBase {
  constructor(config, database, logger) {
    super('F000003C', config, database, logger);

    this.options = config.blockchain.ethereum_ropsten;
  }
}

module.exports = EthRopstenParser;
