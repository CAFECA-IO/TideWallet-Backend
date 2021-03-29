const Bot = require('./Bot');
const Utils = require('./Utils');
const ResponseFormat = require('./ResponseFormat');
const Codes = require('./Codes');

class Explore extends Bot {
  constructor() {
    super();
    this.name = 'Explore';

    // catch cold data
    this.blockchainName = {};
  }

  init({
    config, database, logger, i18n,
  }) {
    return super.init({
      config, database, logger, i18n,
    }).then(() => {
      this.blockchainModel = this.database.db.Blockchain;
      this.blockScannedModel = this.database.db.BlockScanned;
      this.transactionModel = this.database.db.Transaction;
      this.currencyModel = this.database.db.Currency;
      return this;
    });
  }

  async blockchainIdToName(blockchain_id) {
    if (this.blockchainName[blockchain_id]) return this.blockchainName[blockchain_id];
    const findOne = await this.blockchainModel.findOne({
      where: { blockchain_id },
      attributes: ['name'],
    });
    if (!findOne) return '';

    this.blockchainName[blockchain_id] = findOne.name;
    return findOne.name;
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
            attributes: ['name', 'icon', 'symbol', 'decimals'],
          },
        ],
        raw: true,
      });

      const items = findTransactionList.map((item) => ({
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

      return new ResponseFormat({ message: 'User Regist', items, meta });
    } catch (e) {
      this.logger.error('TransactionList e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: `DB Error(${e.message})`, code: Codes.DB_ERROR });
    }
  }

  async BlockList({ query }) {
    try {
      const { index = 0, limit = 20 } = query;
      const findBlocks = await this.blockScannedModel.findAll({
        offset: Number(index),
        limit: Number(limit) + 1,
        attributes: ['blockchain_id', 'block', 'block_hash', 'timestamp', 'result'],
        order: [['timestamp', 'DESC']],
      });
      const items = [];

      for (const item of findBlocks) {
        const itemJSON = JSON.parse(item.result);

        // eslint-disable-next-line no-nested-ternary
        const txCount = (itemJSON.txs !== undefined) ? itemJSON.txs : (itemJSON.transactions) ? itemJSON.transactions.length : 0;
        items.push({
          blockchainId: item.blockScanned_id,
          name: await this.blockchainIdToName(item.blockchain_id),
          blockHeight: item.block,
          blockHash: item.block_hash,
          timestamp: item.timestamp,
          txCount,
        });
      }
      const findAllAmount = await this.blockScannedModel.count();
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

      return new ResponseFormat({ message: 'Explore Block List', items, meta });
    } catch (e) {
      this.logger.error('BlockList e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: `DB Error(${e.message})`, code: Codes.DB_ERROR });
    }
  }
}

module.exports = Explore;
