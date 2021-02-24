const { v4: uuidv4 } = require('uuid');

class ParserBase {
  constructor(blockchainId, database, logger, config) {
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
  }

  async init() {
    this.currencyInfo = await this.getCurrencyInfo();
    this.maxRetry = 3;
    return this;
  }

  async checkRegistAddress(address) {
    this.logger.debug(`[${this.constructor.name}] checkRegistAddress(${address})`);

    try {
      const accountAddress = await this.accountAddressModel.findOne({
        where: { address },
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

  async setAddressTransaction(accountAddress_id, transaction_id, direction) {
    this.logger.debug(`[${this.constructor.name}] setAddressTransaction(${accountAddress_id}, ${transaction_id}, ${direction})`);
    try {
      const result = await this.addressTransactionModel.findOrCreate({
        where: {
          currency_id: this.currencyInfo.currency_id,
          accountAddress_id,
          transaction_id,
          direction,
        },
        defaults: {
          addressTransaction_id: uuidv4(),
          currency_id: this.currencyInfo.currency_id,
          accountAddress_id,
          transaction_id,
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
