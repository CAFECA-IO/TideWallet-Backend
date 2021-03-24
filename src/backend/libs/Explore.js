const Bot = require('./Bot');
const ResponseFormat = require('./ResponseFormat');
const Codes = require('./Codes');

class Explore extends Bot {
  constructor() {
    super();
    this.name = 'Explore';
  }

  init({
    config, database, logger, i18n,
  }) {
    return super.init({
      config, database, logger, i18n,
    }).then(() => {
      this.transactionModel = this.database.db.Transaction;
      this.currencyModel = this.database.db.Currency;
      return this;
    });
  }

  async TransactionList({ query }) {
    try {
      const { index = 0, limit = 20 } = query;

      const findTransactionList = await this.transactionModel.findAll({
        offset: Number(index),
        limit: Number(limit) + 1,
        order: [['transaction_id', 'DESC']],
        attributes: ['transaction_id', 'currency_id', 'txid', 'timestamp', 'source_addresses', 'destination_addresses', 'amount', 'block'],
        include: [
          {
            model: this.currencyModel,
            attributes: ['name'],
          },
        ],
        raw: true,
      });

      const items = findTransactionList.map((item) => {
        const result = { ...item };
        result.currency_name = result['Currency.name'];
        delete result['Currency.name'];
        return result;
      });
      const findAllAmount = await this.transactionModel.findAndCountAll({});

      const meta = {
        hasNext: false,
        nextIndex: 0,
        count: findAllAmount.count || 0,
      };

      if (items.length > Number(limit)) {
        items.pop();
        meta.hasNext = true;
        meta.nextIndex = Number(index) + Number(limit);
      }

      return new ResponseFormat({ message: 'User Regist', items, meta });
    } catch (e) {
      this.logger.error('TransactionList e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: `DB Error(${e.message})`, code: Codes.DB_ERROR });
    }
  }
}

module.exports = Explore;
