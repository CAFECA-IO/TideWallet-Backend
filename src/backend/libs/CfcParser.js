const EthParserBase = require('./EthParserBase');

class CfcParser extends EthParserBase {
  constructor(config, database, logger) {
    super('80000CFC', config, database, logger);

    this.options = config.blockchain.cafeca;
  }
}

module.exports = CfcParser;
