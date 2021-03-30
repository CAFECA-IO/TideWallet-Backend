const BtcCrawlerManagerBase = require('./BtcCrawlerManagerBase');

class BtcCrawlerManager extends BtcCrawlerManagerBase {
  constructor(config, database, logger) {
    super('80000000', database, logger);
    this.options = config.blockchain.bitcoin_mainnet;
    this.syncInterval = config.syncInterval.bitcoin ? config.syncInterval.bitcoin : 450000;
    this.feeSyncInterval = config.syncInterval.fee ? config.syncInterval.fee : 3600000;
    this.pendingTxSyncInterval = config.syncInterval.pending ? config.syncInterval.pending : 15000;
    this.unparsedTxModel = database.db.UnparsedTransaction80000000;
  }
}

module.exports = BtcCrawlerManager;
