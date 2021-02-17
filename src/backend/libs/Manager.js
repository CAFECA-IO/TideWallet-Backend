const Bot = require('./Bot');
const BtcCrawlerManager = require('./BtcCrawlerManager');
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
      this._crawlerManager = this.createManager();
      return this;
    });
  }

  start() {
    return super.start()
      .then(() => {
        this._crawlerManager = this.initManager();
        return this;
      });
  }

  createManager() {
    const result = [];
    result.push(new BtcCrawlerManager(this.config, this.database, this.logger));
    result.push(new EthCrawlerManager(this.config, this.database, this.logger));
    result.push(new EthRopstenCrawlerManager(this.config, this.database, this.logger));

    return result;
  }

  initManager() {
    this._crawlerManager.forEach((manager) => {
      manager.init();
    });
  }
}

module.exports = Manager;
