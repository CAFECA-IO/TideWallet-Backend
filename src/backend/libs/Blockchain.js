const BigNumber = require('bignumber.js');
const ResponseFormat = require('./ResponseFormat'); const Bot = require('./Bot.js');
const Codes = require('./Codes');
const blockchainNetworks = require('./data/blockchainNetworks');
const currency = require('./data/currency');

class Blockchain extends Bot {
  constructor() {
    super();
    this.name = 'Blockchain';
    this.tags = {};
  }

  init({
    config, database, logger, i18n,
  }) {
    return super.init({
      config, database, logger, i18n,
    }).then(() => {
      this.blockchainModel = this.database.db.Blockchain;
      this.currencyModel = this.database.db.Currency;
      this.sequelize = this.database.db.sequelize;
      this.Sequelize = this.database.db.Sequelize;
      return this;
    }).then(async () => {
      await this.initBlockchainNetworks();
      await this.initCurrency();
      return this;
    });
  }

  async initBlockchainNetworks() {
    const networks = Object.values(blockchainNetworks);
    for (let i = 0; i < networks.length; i++) {
      const network = networks[i];
      network.bip32_public = network.bip32.public;
      network.bip32_private = network.bip32.private;
      delete network.bip32;
      await this.blockchainModel.findOrCreate({
        where: { blockchain_id: network.blockchain_id },
        defaults: network,
      });
    }
  }

  async initCurrency() {
    for (let i = 0; i < currency.length; i++) {
      const currencyItem = currency[i];

      await this.currencyModel.findOrCreate({
        where: { currency_id: currencyItem.currency_id },
        defaults: currencyItem,
      });
    }
  }

  async BlockchainList() {
    try {
      let payload = await this.blockchainModel.findAll();
      if (payload) {
        payload = payload.map((item) => ({
          blockchain_id: item.blockchain_id,
          name: item.name,
          coin_type: item.coin_type,
          network_id: item.network_id,
          publish: item.publish,
        }));
      }
      return new ResponseFormat({ message: 'List Supported Blockchains', payload });
    } catch (e) {
      this.logger.error('BlockchainList e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: 'DB Error', code: Codes.DB_ERROR });
    }
  }

  async BlockchainDetail({ params }) {
    const { blockchain_id } = params;
    try {
      const payload = await this.blockchainModel.findOne({
        where: { blockchain_id },
      });

      if (!payload) return new ResponseFormat({ message: 'blockchain_id Not Found', code: Codes.BLOCKCHAIN_ID_NOT_FOUND });
      return new ResponseFormat({ message: 'Get Blockchain Detail', payload });
    } catch (e) {
      this.logger.error('BlockchainDetail e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: 'DB Error', code: Codes.DB_ERROR });
    }
  }

  async CurrencyList() {
    try {
      let payload = await this.currencyModel.findAll({
        where: {
          [this.Sequelize.Op.or]: [{ type: 0 }, { type: 1 }],
        },
      });
      if (payload) {
        payload = payload.map((item) => ({
          currency_id: item.currency_id,
          name: item.name,
          symbol: item.symbol,
          type: item.type,
          publish: item.publish,
          decimals: item.decimals,
          exchange_rate: item.exchange_rate,
          icon: item.icon,
        }));
      }
      return new ResponseFormat({ message: 'List Supported Currencies', payload });
    } catch (e) {
      this.logger.error('CurrencyList e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: 'DB Error', code: Codes.DB_ERROR });
    }
  }

  async CurrencyDetail({ params }) {
    const { currency_id } = params;
    try {
      const payload = await this.currencyModel.findOne({
        where: {
          currency_id,
          [this.Sequelize.Op.or]: [{ type: 0 }, { type: 1 }],
        },
      });

      if (!payload) return new ResponseFormat({ message: 'currency_id Not Found', code: Codes.CURRENCY_ID_NOT_FOUND });
      return new ResponseFormat({ message: 'Get Currency Detail', payload });
    } catch (e) {
      this.logger.error('CurrencyDetail e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: 'DB Error', code: Codes.DB_ERROR });
    }
  }

  async TokenList({ params }) {
    const { blockchain_id } = params;
    try {
      let payload = await this.currencyModel.findAll({
        where: { blockchain_id, type: 2 },
      });
      if (payload) {
        payload = payload.map((item) => ({
          currency_id: item.currency_id,
          name: item.name,
          symbol: item.symbol,
          type: item.type,
          publish: item.publish,
          decimals: item.decimals,
          exchange_rate: item.exchange_rate,
          icon: item.icon,
        }));
      } else {
        payload = [];
      }
      return new ResponseFormat({ message: 'List Supported Currencies', payload });
    } catch (e) {
      this.logger.error('TokenList e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: 'DB Error', code: Codes.DB_ERROR });
    }
  }

  async TokenDetail({ params }) {
    const { blockchain_id, token_id } = params;
    try {
      const payload = await this.currencyModel.findOne({
        where: {
          currency_id: token_id, type: 2,
        },
      });

      if (!payload) return new ResponseFormat({ message: 'currency_id Not Found', code: Codes.CURRENCY_ID_NOT_FOUND });
      if (payload.blockchain_id !== blockchain_id) return new ResponseFormat({ message: 'currency_id Not Found', code: Codes.CURRENCY_ID_NOT_FOUND });
      return new ResponseFormat({ message: 'Get Currency Detail', payload });
    } catch (e) {
      this.logger.error('TokenDetail e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: 'DB Error', code: Codes.DB_ERROR });
    }
  }

  async GetFee({ params }) {
    try {
      const { blockchain_id } = params;

      const findBlockchainInfo = await this.blockchainModel.findOne({ where: { blockchain_id }, attributes: ['avg_fee'] });
      if (!findBlockchainInfo) return new ResponseFormat({ message: 'blockchain_id not found', code: Codes.BLOCKCHAIN_ID_NOT_FOUND });

      const { avg_fee = '0' } = findBlockchainInfo;

      const slow = new BigNumber(avg_fee).multipliedBy(0.8).toFixed();
      const fast = new BigNumber(avg_fee).multipliedBy(1.5).toFixed();

      return new ResponseFormat({
        message: 'Get Currency Detail',
        payload: {
          slow,
          standard: avg_fee,
          fast,
        },
      });
    } catch (e) {
      this.logger.error('GetFee e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: 'DB Error', code: Codes.DB_ERROR });
    }
  }
}

module.exports = Blockchain;
