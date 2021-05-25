const BtcCrawlerManagerBase = require('./BtcCrawlerManagerBase');

class BtcTestnetCrawlerManager extends BtcCrawlerManagerBase {
  constructor(config, database, logger) {
    super('F0000000', database, logger);
    this.options = config.blockchain.bitcoin_testnet;
    this.syncInterval = config.syncInterval.bitcoin ? config.syncInterval.bitcoin : 450000;
    this.feeSyncInterval = config.syncInterval.fee ? config.syncInterval.fee : 3600000;
    this.pendingTxSyncInterval = config.syncInterval.pending ? config.syncInterval.pending : 15000;
  }
}

module.exports = BtcTestnetCrawlerManager;
