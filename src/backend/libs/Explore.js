const Bot = require('./Bot');
const Utils = require('./Utils');
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
      this.blockchainModel = this.database.db.Blockchain;
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
        attributes: ['transaction_id', 'currency_id', 'txid', 'timestamp', 'source_addresses', 'destination_addresses', 'amount', 'block', 'fee'],
        include: [
          {
            model: this.currencyModel,
            attributes: ['blockchain_id', 'name', 'icon', 'symbol', 'decimals'],
          },
        ],
        raw: true,
      });

      const items = findTransactionList.map((item) => ({
        blockchainId: item['Currency.blockchain_id'],
        iconUrl: item['Currency.icon'],
        txHash: item.txid,
        symbol: item['Currency.symbol'],
        block: item.block,
        timestamp: item.timestamp,
        from: item.source_addresses,
        to: item.destination_addresses,
        value: Utils.dividedByDecimal(item.amount, item['Currency.decimals']),
        fee: Utils.dividedByDecimal(item.fee, item['Currency.decimals']),
      }));
      const findAllAmount = await this.transactionModel.count();
      const meta = {
        hasNext: false,
        nextIndex: 0,
        count: findAllAmount || 0,
      };

      if (items.length > Number(limit)) {
        items.pop();
        meta.hasNext = true;
        meta.nextIndex = Number(index) + Number(limit);
      }

      return new ResponseFormat({ message: 'Explore Transaction List', items, meta });
    } catch (e) {
      this.logger.error('TransactionList e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: `DB Error(${e.message})`, code: Codes.DB_ERROR });
    }
  }

  async NodeInfo({ query }) {
    try {
      const { index = 0, limit = 20 } = query;
      const findBlockchain = await this.blockchainModel.findAll({
        attributes: ['blockchain_id', 'name', 'block', 'avg_fee'],
      });

      // calculator tps
      const tpsItems = [];
      for (let i = 0; i < findBlockchain.length; i++) {
        switch (findBlockchain[i].blockchain_id) {
          case '8000003C':
          case '8000025B':
          case '80000CFC':
            tpsItems.push(Utils.getETHTps(findBlockchain[i].blockchain_id, findBlockchain[i].block));
            break;
          case '80000000':
          case '80000001':
            tpsItems.push(Utils.getBTCTps(findBlockchain[i].blockchain_id, findBlockchain[i].block));
            break;
          default:
            break;
        }
      }

      const items = [];
      const findAllTps = await Promise.all(tpsItems).catch((error) => new ResponseFormat({ message: `rpc error(${error})`, code: Codes.RPC_ERROR }));
      if (findAllTps.code === Codes.RPC_ERROR) return 0;
      findAllTps.forEach((tps, i) => {
        items.push({
          blockchainId: findBlockchain[i].blockchain_id,
          name: findBlockchain[i].name,
          tps,
          blockHeight: findBlockchain[i].block,
          avgFee: findBlockchain[i].avg_fee,
        });
      });

      const findAllAmount = await this.blockchainModel.count();
      const meta = {
        hasNext: false,
        nextIndex: 0,
        count: findAllAmount || 0,
      };

      if (items.length > Number(limit)) {
        items.pop();
        meta.hasNext = true;
        meta.nextIndex = Number(index) + Number(limit);
      }

      return new ResponseFormat({ message: 'Explore Node Info', items, meta });
    } catch (e) {
      console.log(e);
      this.logger.error('NodeInfo e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: `DB Error(${e.message})`, code: Codes.DB_ERROR });
    }
  }
}

module.exports = Explore;
