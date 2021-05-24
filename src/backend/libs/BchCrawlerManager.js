const BchCrawlerManagerBase = require('./BchCrawlerManagerBase');

class BchCrawlerManager extends BchCrawlerManagerBase {
  constructor(config, database, logger) {
    super('80000091', database, logger);
    this.options = config.blockchain.bitcoin_cash_mainnet;
    this.syncInterval = config.syncInterval.bitcoin ? config.syncInterval.bitcoin : 450000;
    this.feeSyncInterval = config.syncInterval.fee ? config.syncInterval.fee : 3600000;
    this.pendingTxSyncInterval = config.syncInterval.pending ? config.syncInterval.pending : 15000;
  }
}

module.exports = BchCrawlerManager;
