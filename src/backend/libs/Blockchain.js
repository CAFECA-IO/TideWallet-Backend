const ResponseFormat = require('./ResponseFormat');
const Bot = require('./Bot.js');
const Codes = require('./Codes');

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
    });
  }

  async BlockchainList() {
    try {
      let payload = await this.blockchainModel.findAll();
      if (payload) {
        payload = payload.map((item) => ({
          Blockchain_id: item.Blockchain_id,
          name: item.name,
          coin_type: item.coin_type,
          network_id: item.network_id,
          publish: item.publish,
        }));
      }
      return new ResponseFormat({ message: 'List Supported Blockchains', payload });
    } catch (e) {
      return new ResponseFormat({ message: 'DB Error', code: Codes.DB_ERROR });
    }
  }

  async BlockchainDetail({ params }) {
    const { blockchain_id } = params;
    try {
      const payload = await this.blockchainModel.findOne({
        where: { Blockchain_id: blockchain_id },
      });

      if (!payload) return new ResponseFormat({ message: 'blockchain_id Not Found', code: Codes.BLOCKCHAIN_ID_NOT_FOUND });
      return new ResponseFormat({ message: 'Get Blockchain Detail', payload });
    } catch (e) {
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
          Currency_id: item.Currency_id,
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
      return new ResponseFormat({ message: 'DB Error', code: Codes.DB_ERROR });
    }
  }

  async CurrencyDetail({ params }) {
    const { currency_id } = params;
    try {
      const payload = await this.currencyModel.findOne({
        where: {
          Currency_id: currency_id,
          [this.Sequelize.Op.or]: [{ type: 0 }, { type: 1 }],
        },
      });

      if (!payload) return new ResponseFormat({ message: 'currency_id Not Found', code: Codes.CURRENCY_ID_NOT_FOUND });
      return new ResponseFormat({ message: 'Get Currency Detail', payload });
    } catch (e) {
      return new ResponseFormat({ message: 'DB Error', code: Codes.DB_ERROR });
    }
  }

  async TokenList({ params }) {
    const { blockchain_id } = params;
    try {
      let payload = await this.currencyModel.findAll({
        where: { Blockchain_id: blockchain_id, type: 2 },
      });
      if (payload) {
        payload = payload.map((item) => ({
          Currency_id: item.Currency_id,
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
      return new ResponseFormat({ message: 'DB Error', code: Codes.DB_ERROR });
    }
  }

  async TokenDetail({ params }) {
    const { blockchain_id, token_id } = params;
    try {
      const payload = await this.currencyModel.findOne({
        where: {
          Currency_id: token_id, type: 2,
        },
      });

      if (!payload) return new ResponseFormat({ message: 'currency_id Not Found', code: Codes.CURRENCY_ID_NOT_FOUND });
      if (payload.Blockchain_id !== blockchain_id) return new ResponseFormat({ message: 'currency_id Not Found', code: Codes.CURRENCY_ID_NOT_FOUND });
      return new ResponseFormat({ message: 'Get Currency Detail', payload });
    } catch (e) {
      return new ResponseFormat({ message: 'DB Error', code: Codes.DB_ERROR });
    }
  }
}

module.exports = Blockchain;
