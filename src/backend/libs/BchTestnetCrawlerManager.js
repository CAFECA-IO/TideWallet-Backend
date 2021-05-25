const BchCrawlerManagerBase = require('./BchCrawlerManagerBase');

class BchTestnetCrawlerManager extends BchCrawlerManagerBase {
  constructor(config, database, logger) {
    super('F0000091', database, logger);
    this.options = config.blockchain.bitcoin_cash_testnet;
    this.syncInterval = config.syncInterval.bitcoin_cash ? config.syncInterval.bitcoin_cash : 450000;
    this.feeSyncInterval = config.syncInterval.fee ? config.syncInterval.fee : 3600000;
    this.pendingTxSyncInterval = config.syncInterval.pending ? config.syncInterval.pending : 15000;
  }
}

module.exports = BchTestnetCrawlerManager;
