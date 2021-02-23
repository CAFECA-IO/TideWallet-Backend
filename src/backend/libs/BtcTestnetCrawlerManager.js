const BtcCrawlerManagerBase = require('./BtcCrawlerManagerBase');

class BtcTestnetCrawlerManager extends BtcCrawlerManagerBase {
  constructor(config, database, logger) {
    super('80000001', database, logger);
    this.options = config.bitcoin.testnet;
    this.syncInterval = config.syncInterval.bitcoin ? config.syncInterval.bitcoin : 900000;
    this.feeSyncInterval = config.syncInterval.fee ? config.syncInterval.fee : 3600000;
  }
}

module.exports = BtcTestnetCrawlerManager;
