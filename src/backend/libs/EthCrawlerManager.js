const EthCrawlerManagerBase = require('./EthCrawlerManagerBase');

class EthCrawlerManager extends EthCrawlerManagerBase {
  constructor(config, database, logger) {
    super('8000003C', database, logger);
    this.options = config.ethereum;
    this.syncInterval = config.syncInterval.ethereum ? config.syncInterval.ethereum : 15000;
  }
}

module.exports = EthCrawlerManager;
