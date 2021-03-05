const BtcParserBase = require('./BtcParserBase');

class BtcTestnetParser extends BtcParserBase {
  constructor(config, database, logger) {
    super('80000001', config, database, logger);

    this.options = config.blockchain.bitcoin_testnet;
  }
}

module.exports = BtcTestnetParser;
