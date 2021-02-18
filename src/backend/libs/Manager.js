const Bot = require('./Bot');
const BtcCrawlerManager = require('./BtcCrawlerManager');
const BtcTestnetCrawlerManager = require('./BtcTestnetCrawlerManager');
const EthCrawlerManager = require('./EthCrawlerManager');
const EthRopstenCrawlerManager = require('./EthRopstenCrawlerManager');

class Manager extends Bot {
  constructor() {
    super();
    this.name = 'Manager';
  }

  init({
    config, database, logger, i18n,
  }) {
    return super.init({
      config, database, logger, i18n,
    }).then(() => {
      if (!this.config.bitcoin.noScan) this._crawlerManagers = this.createManager();
      return this;
    });
  }

  start() {
    if (!this.config.bitcoin.noScan) {
      return super.start()
        .then(() => {
          this._crawlerManagers = this.initManager();
          return this;
        });
    }
  }

  createManager() {
    console.log('createManager');
    const result = [];
    result.push(new BtcCrawlerManager(this.config, this.database, this.logger));
    result.push(new BtcTestnetCrawlerManager(this.config, this.database, this.logger));
    result.push(new EthCrawlerManager(this.config, this.database, this.logger));
    result.push(new EthRopstenCrawlerManager(this.config, this.database, this.logger));

    return result;
  }

  initManager() {
    this._crawlerManagers.forEach((manager) => {
      manager.init();
    });
  }
}

module.exports = Manager;
