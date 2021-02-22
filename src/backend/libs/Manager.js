const schedule = require('node-schedule');
const Bot = require('./Bot');
const BtcCrawlerManager = require('./BtcCrawlerManager');
const CrawlerManagerBase = require('./CrawlerManagerBase');
const BtcTestnetCrawlerManager = require('./BtcTestnetCrawlerManager');
const EthCrawlerManager = require('./EthCrawlerManager');
const EthRopstenCrawlerManager = require('./EthRopstenCrawlerManager');

// test
const EthRopstenParser = require('./EthRopstenParser');

class Manager extends Bot {
  constructor() {
    super();
    this.name = 'Manager';
    this._crawlerManagers = [];
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
          this.initManager();
          this.initSchedule();
          return this;
        });
    }
  }

  createManager() {
    this.logger.log('createManager');
    const result = [];
    // result.push(new BtcCrawlerManager(this.config, this.database, this.logger));
    // result.push(new BtcTestnetCrawlerManager(this.config, this.database, this.logger));
    // result.push(new EthCrawlerManager(this.config, this.database, this.logger));
    // result.push(new EthRopstenCrawlerManager(this.config, this.database, this.logger));
    // result.push(new EthRopstenParser(this.config, this.database, this.logger));
    return result;
  }

  initManager() {
    this._crawlerManagers.forEach((manager) => {
      manager.init();
    });
  }

  initSchedule() {
    // sync all address balance form db
    schedule.scheduleJob({
      hour: 0, minute: 0, second: 0, tz: 'Asia/Taipei',
    }, async () => {
      for (const currency of this._crawlerManagers) {
        if (currency instanceof CrawlerManagerBase) {
          await currency.fullSyncAddressesBalance();
        }
      }
    });
  }
}

module.exports = Manager;
