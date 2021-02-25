const EthParserBase = require('./EthParserBase');

class EthRopstenParser extends EthParserBase {
  constructor(config, database, logger) {
    super('8000025B', config, database, logger);

    this.options = config.blockchain.ethereum_ropsten;
    this.syncInterval = config.syncInterval.ethereum ? config.syncInterval.ethereum : 15000;
  }
}

module.exports = EthRopstenParser;
