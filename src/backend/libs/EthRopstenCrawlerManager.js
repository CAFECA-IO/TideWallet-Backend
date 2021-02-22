const EthCrawlerManagerBase = require('./EthCrawlerManagerBase');

class EthRopstenCrawlerManager extends EthCrawlerManagerBase {
  constructor(config, database, logger) {
    super('8000025B', database, logger);
    this.options = config.ethereum.ropsten;
    this.syncInterval = config.syncInterval.ethereum ? config.syncInterval.ethereum : 15000;
  }
}

module.exports = EthRopstenCrawlerManager;
