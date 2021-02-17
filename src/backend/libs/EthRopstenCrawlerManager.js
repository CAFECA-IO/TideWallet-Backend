const EthCrawlerManagerBase = require('./EthCrawlerManagerBase');

class EthRopstenCrawlerManager extends EthCrawlerManagerBase {
  constructor(config, database, logger) {
    super('80000603', database, logger);
    this.options = config.ethereum.ropsten;
    this.syncInterval = config.syncInterval.ethereum ? config.syncInterval.ethereum : 15000;
  }
}

module.exports = EthRopstenCrawlerManager;
