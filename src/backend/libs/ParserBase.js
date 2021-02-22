const { v4: uuidv4 } = require('uuid');

class ParserBase {
  constructor(blockchainId, database, logger) {
    this.bcid = blockchainId;
    this.database = database;
    this.logger = logger;

    this.blockchainModel = this.database.db.Blockchain;
    this.blockScannedModel = this.database.db.BlockScanned;
    this.currencyModel = this.database.db.Currency;
    this.sequelize = this.database.db.sequelize;
    this.unparsedTxModel = this.database.db.UnparsedTransaction;

    this.transactionModel = this.database.db.Transaction;
    this.accountModel = this.database.db.Account;
    this.accountAddressModel = this.database.db.AccountAddress;
    this.accountCurrencyModel = this.database.db.AccountCurrency;
    this.addressTransactionModel = this.database.db.AddressTransaction;
  }

  async init() {
    this.currencyInfo = await this.getCurrencyInfo();
    return this;
  }

  async checkRegistAddress(address) {
    this.logger.log(`[${this.constructor.name}] checkRegistAddress(${address})`);

    try {
      const accountAddress = await this.accountAddressModel.findOne({
        where: { address },
      });
      return accountAddress;
    } catch (error) {
      this.logger.log(`[${this.constructor.name}] checkRegistAddress(${address}) error`);
      this.logger.log(error);
      return Promise.reject(error);
    }
  }

  async getCurrencyInfo() {
    this.logger.log(`[${this.constructor.name}] getCurrencyInfo`);
    try {
      const result = await this.currencyModel.findOne({
        where: { blockchain_id: this.bcid },
      });
      return result;
    } catch (error) {
      this.logger.log(`[${this.constructor.name}] currencyModel error ${error}`);
      return {};
    }
  }

  async getUnparsedTxs() {
    this.logger.log(`[${this.constructor.name}] getUnparsedTxs`);
    try {
      const oldest = await this.unparsedTxModel.findAll({
        limit: 1,
        where: { blockchain_id: this.bcid },
        order: [['timestamp', 'ASC']],
      });

      if (!oldest || oldest.length === 0) {
        this.logger.log(`[${this.constructor.name}] getUnparsedTxs not found`);
        return [];
      }

      const { timestamp } = oldest[0];
      const result = await this.unparsedTxModel.findAll({
        where: { blockchain_id: this.bcid, timestamp },
      });
      return result;
    } catch (error) {
      this.logger.log(`[${this.constructor.name}] getUnparsedTxs error ${error}`);
      return {};
    }
  }

  async setAddressTransaction(accountAddress_id, transaction_id, direction) {
    this.logger.log(`[${this.constructor.name}] setAddressTransaction(${accountAddress_id}, ${transaction_id}, ${direction})`);
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
      this.logger.log(`[${this.constructor.name}] setAddressTransaction(${accountAddress_id}, ${transaction_id}, ${direction}) error`);
      this.logger.log(error);
      return Promise.reject(error);
    }
  }

  async parseTx() {
    // need override
  }

  async removeParsedTx(tx) {
    this.logger.log(`[${this.constructor.name}] removeParsedTx(${tx.unparsedTransaction_id})`);
    try {
      return await this.unparsedTxModel.destroy({
        where: { unparsedTransaction_id: tx.unparsedTransaction_id },
      });
    } catch (error) {
      this.logger.log(`[${this.constructor.name}] removeParsedTx(${tx.unparsedTransaction_id})`);
      this.logger.log(error);
      return Promise.reject(error);
    }
  }
}

module.exports = ParserBase;
