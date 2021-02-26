const EthParserBase = require('./EthParserBase');

class CfcParser extends EthParserBase {
  constructor(config, database, logger) {
    super('80000CFC', config, database, logger);

    this.options = config.blockchain.cafeca;
    this.syncInterval = config.syncInterval.cafeca ? config.syncInterval.cafeca : 15000;
  }
}

module.exports = CfcParser;
