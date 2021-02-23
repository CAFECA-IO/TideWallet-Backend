const EthCrawlerManagerBase = require('./EthCrawlerManagerBase');

class EthRopstenCrawlerManager extends EthCrawlerManagerBase {
  constructor(config, database, logger) {
    super('80000603', database, logger);
    this.options = config.ethereum.ropsten;
    this.syncInterval = config.syncInterval.ethereum ? config.syncInterval.ethereum : 15000;
    this.feeSyncInterval = config.syncInterval.fee ? config.syncInterval.fee : 3600000;
  }
}

module.exports = EthRopstenCrawlerManager;
