const BtcParserBase = require('./BtcParserBase');

class BtcTestnetParser extends BtcParserBase {
  constructor(config, database, logger) {
    super('80000001', config, database, logger);

    this.options = config.blockchain.bitcoin_testnet;
    this.syncInterval = config.syncInterval.bitcoin ? config.syncInterval.bitcoin : 900000;
  }
}

module.exports = BtcTestnetParser;
