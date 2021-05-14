const EthCrawlerManagerBase = require('./EthCrawlerManagerBase');

class CfcCrawlerManager extends EthCrawlerManagerBase {
  constructor(config, database, logger) {
    super('80000CFC', database, logger);
    this.options = config.blockchain.cafeca;
    this.syncInterval = config.syncInterval.cafeca ? config.syncInterval.cafeca : 15000;
    this.feeSyncInterval = config.syncInterval.fee ? config.syncInterval.fee : 3600000;
    this.pendingTxSyncInterval = config.syncInterval.pending ? config.syncInterval.pending : 15000;
  }
}

module.exports = CfcCrawlerManager;
