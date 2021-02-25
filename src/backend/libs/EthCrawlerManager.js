const EthCrawlerManagerBase = require('./EthCrawlerManagerBase');

class EthCrawlerManager extends EthCrawlerManagerBase {
  constructor(config, database, logger) {
    super('8000003C', database, logger);
    this.options = config.blockchain.ethereum_mainnet;
    this.syncInterval = config.syncInterval.ethereum ? config.syncInterval.ethereum : 15000;
    this.feeSyncInterval = config.syncInterval.fee ? config.syncInterval.fee : 3600000;
  }
}

module.exports = EthCrawlerManager;
