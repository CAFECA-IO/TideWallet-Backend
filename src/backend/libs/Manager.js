const ecrequest = require('ecrequest');
const { v4: uuidv4 } = require('uuid');
const { default: BigNumber } = require('bignumber.js');
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
    this.rateSyncInterval = 86400000;
  }

  init({
    config, database, logger, i18n,
  }) {
    return super.init({
      config, database, logger, i18n,
    }).then(() => {
      if (!this.config.bitcoin.noScan) this._crawlerManagers = this.createManager();

      this.fiatCurrencyRateModel = this.database.db.FiatCurrencyRate;
      this.currencyModel = this.database.db.Currency;

      setInterval(() => {
        this.syncRate();
      }, this.rateSyncInterval);
      this.syncRate();
      return this;
    });
  }

  start() {
    if (!this.config.bitcoin.noScan) {
      return super.start()
        .then(() => {
          this.initManager();
          return this;
        });
    }
  }

  syncRate() {
    const opt = {
      protocol: 'https:',
      port: '',
      hostname: 'rate.bot.com.tw',
      path: '/xrt/fltxt/0/day',
    };

    ecrequest.get(opt).then(async (rs) => {
      const parseObject = rs.data.toString().split('\n').map((item) => item.split(/[ ]+/));

      for (const item of parseObject) {
        const findCurrency = await this.currencyModel.findOne({
          where: { symbol: item[0], type: 0 },
        });
        if (findCurrency) {
          const findRate = await this.fiatCurrencyRateModel.findOne({
            where: { currency_id: findCurrency.currency_id },
          });
          if (findRate) {
            // if found, update it
            await this.fiatCurrencyRateModel.update(
              { balance: new BigNumber(item[3]).toFixed() },
              { where: { fiatCurrencyRate_id: findRate.fiatCurrencyRate_id, currency_id: findCurrency.currency_id } },
            );
          } else {
            // if not found, create
            await this.fiatCurrencyRateModel.create({
              fiatCurrencyRate_id: uuidv4(),
              currency_id: findCurrency.currency_id,
              rate: new BigNumber(item[3]).toFixed(),
            });
          }
        }
      }
    });
  }

  createManager() {
    this.logger.log('createManager');
    const result = [];
    // result.push(new BtcCrawlerManager(this.config, this.database, this.logger));
    result.push(new BtcTestnetCrawlerManager(this.config, this.database, this.logger));
    // result.push(new EthCrawlerManager(this.config, this.database, this.logger));
    result.push(new EthRopstenCrawlerManager(this.config, this.database, this.logger));
    result.push(new EthRopstenParser(this.config, this.database, this.logger));
    return result;
  }

  initManager() {
    this._crawlerManagers.forEach((manager) => {
      manager.init();
    });
  }
}

module.exports = Manager;
