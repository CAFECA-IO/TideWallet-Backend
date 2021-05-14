const BtcParserBase = require('./BtcParserBase');

class BtcParser extends BtcParserBase {
  constructor(config, database, logger) {
    super('80000000', config, database, logger);

    this.options = config.blockchain.bitcoin_mainnet;
  }
}

module.exports = BtcParser;
