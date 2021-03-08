const { v4: uuidv4 } = require('uuid');

class ParserBase {
  constructor(blockchainId, config, database, logger) {
    this.bcid = blockchainId;
    this.database = database;
    this.logger = logger;
    this.config = config;

    this.blockchainModel = this.database.db.Blockchain;
    this.blockScannedModel = this.database.db.BlockScanned;
    this.currencyModel = this.database.db.Currency;
    this.sequelize = this.database.db.sequelize;
    this.Sequelize = this.database.db.Sequelize;
    this.unparsedTxModel = this.database.db.UnparsedTransaction;

    this.transactionModel = this.database.db.Transaction;
    this.accountModel = this.database.db.Account;
    this.accountAddressModel = this.database.db.AccountAddress;
    this.accountCurrencyModel = this.database.db.AccountCurrency;
    this.addressTransactionModel = this.database.db.AddressTransaction;
    this.pendingTransactionModel = this.database.db.PendingTransaction;
  }

  async init() {
    this.currencyInfo = await this.getCurrencyInfo();
    this.maxRetry = 3;
    return this;
  }

  async blockNumberFromDB() {
    this.logger.debug(`[${this.constructor.name}] blockNumberFromDB`);
    try {
      const result = await this.blockchainModel.findOne({
        where: { blockchain_id: this.bcid },
      });
      return result.block;
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] blockNumberFromDB error ${error}`);
      return 0;
    }
  }

  async blockDataFromDB(block_hash) {
    this.logger.debug(`[${this.constructor.name}] blockNumberFromDB`);
    try {
      const result = await this.blockScannedModel.findOne({
        where: { blockchain_id: this.bcid, block_hash },
      });
      return result;
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] blockNumberFromDB error ${error}`);
      return 0;
    }
  }

  async checkRegistAddress(address) {
    this.logger.debug(`[${this.constructor.name}] checkRegistAddress(${address})`);

    try {
      const accountAddress = await this.accountAddressModel.findOne({
        where: { address },
        include: [
          {
            model: this.accountModel,
            attributes: ['blockchain_id'],
            where: { blockchain_id: this.bcid },
          },
        ],
      });
      return accountAddress;
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] checkRegistAddress(${address}) error: ${error}`);
      return Promise.reject(error);
    }
  }

  async getCurrencyInfo() {
    this.logger.debug(`[${this.constructor.name}] getCurrencyInfo`);
    try {
      const result = await this.currencyModel.findOne({
        where: { blockchain_id: this.bcid },
      });
      return result;
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] currencyModel error ${error}`);
      return {};
    }
  }

  async getPendingTransactionFromDB() {
    this.logger.debug(`[${this.constructor.name}] getPendingTransactionFromDB`);
    try {
      const latest = await this.pendingTransactionModel.findAll({
        limit: 1,
        where: { blockchain_id: this.bcid },
        order: [['timestamp', 'DESC']],
      });

      if (latest.length > 0) {
        return JSON.parse(latest[0].transactions);
      }
      return latest;
    } catch (error) {
      this.logger.debug(`[${this.constructor.name}] getPendingTransactionFromDB error: ${error}`);
      return [];
    }
  }

  async getTransactionsResultNull() {
    this.logger.debug(`[${this.constructor.name}] getTransactionsResultNull`);
    try {
      const pendingTxs = await this.transactionModel.findAll({
        where: { currency_id: this.currencyInfo.currency_id, result: null },
      });
      return pendingTxs;
    } catch (error) {
      this.logger.debug(`[${this.constructor.name}] getTransactionsResultNull error: ${error}`);
      return [];
    }
  }

  async getUnparsedTxs() {
    this.logger.debug(`[${this.constructor.name}] getUnparsedTxs`);
    try {
      const { Op } = this.Sequelize;
      const oldest = await this.unparsedTxModel.findAll({
        limit: 1,
        where: { blockchain_id: this.bcid, retry: { [Op.lt]: this.maxRetry } },
        order: [['timestamp', 'ASC']],
      });

      if (!oldest || oldest.length === 0) {
        this.logger.log(`[${this.constructor.name}] getUnparsedTxs not found`);
        return [];
      }

      const { timestamp } = oldest[0];
      const result = await this.unparsedTxModel.findAll({
        where: { blockchain_id: this.bcid, timestamp, retry: { [Op.lt]: this.maxRetry } },
      });
      return result;
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] getUnparsedTxs error ${error}`);
      return {};
    }
  }

  async setAddressTransaction(accountAddress_id, transaction_id, amount, direction) {
    this.logger.debug(`[${this.constructor.name}] setAddressTransaction(${accountAddress_id}, ${transaction_id}, ${direction})`);
    try {
      const result = await this.addressTransactionModel.findOrCreate({
        where: {
          currency_id: this.currencyInfo.currency_id,
          accountAddress_id,
          transaction_id,
          amount,
          direction,
        },
        defaults: {
          addressTransaction_id: uuidv4(),
          currency_id: this.currencyInfo.currency_id,
          accountAddress_id,
          transaction_id,
          amount,
          direction,
        },
      });
      return result;
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] setAddressTransaction(${accountAddress_id}, ${transaction_id}, ${direction}) error: ${error}`);
      return Promise.reject(error);
    }
  }

  async parseTx() {
    // need override
  }

  async parsePendingTransaction() {
    // need override
    return Promise.resolve();
  }

  async removeParsedTx(tx) {
    this.logger.debug(`[${this.constructor.name}] removeParsedTx(${tx.unparsedTransaction_id})`);
    try {
      return await this.unparsedTxModel.destroy({
        where: { unparsedTransaction_id: tx.unparsedTransaction_id },
      });
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] removeParsedTx(${tx.unparsedTransaction_id}) error: ${error}`);
      return Promise.reject(error);
    }
  }

  async updateBalance() {
    // need override
    return Promise.resolve();
  }

  async updateRetry(tx) {
    this.logger.debug(`[${this.constructor.name}] updateRetry(${tx.unparsedTransaction_id})`);
    try {
      return await this.unparsedTxModel.update(
        {
          retry: tx.retry + 1,
          last_retry: Math.floor(Date.now() / 1000),
        },
        { where: { unparsedTransaction_id: tx.unparsedTransaction_id } },
      );
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] updateRetry(${tx.unparsedTransaction_id}) error: ${error}`);
      return Promise.reject(error);
    }
  }
}

module.exports = ParserBase;
