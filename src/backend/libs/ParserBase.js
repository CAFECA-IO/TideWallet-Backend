const amqp = require('amqplib');

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

    this.amqpHost = this.config.rabbitmq.host;
  }

  async init() {
    this.currencyInfo = await this.getCurrencyInfo();
    this.maxRetry = 3;
    this.queueChannel = await amqp.connect(this.amqpHost).then((conn) => conn.createChannel());
    this.queueChannel.prefetch(1);
    this.jobQueue = `${this.bcid}ParseJob`;
    this.jobCallback = `${this.bcid}ParseJobCallback`;
    await this.queueChannel.assertQueue(this.jobCallback, { durable: true });
    await this.queueChannel.assertQueue(this.jobQueue, { durable: true });

    this.getJob();

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
      return Promise.reject(error);
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

  // eslint-disable-next-line no-unused-vars
  async doJob(job) {
    // need override
    await this.parseTx();
    return Promise.resolve();
  }

  async getCurrencyInfo() {
    this.logger.debug(`[${this.constructor.name}] getCurrencyInfo`);
    try {
      const result = await this.currencyModel.findOne({
        where: { blockchain_id: this.bcid, type: 1 },
        attributes: ['currency_id', 'decimals'],
      });
      return result;
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] currencyModel error ${error}`);
      return {};
    }
  }

  async getJob() {
    this.logger.debug(`[${this.constructor.name}] getJob`);
    let tmpMsg;
    try {
      await this.queueChannel.consume(this.jobQueue, async (msg) => {
        tmpMsg = msg;
        const job = JSON.parse(msg.content.toString());
        const jobDone = await this.doJob(job);

        // IMPORTENT!!! remove from queue
        await this.queueChannel.ack(msg);

        await this.setJobCallback(jobDone);

        return job;
      }, { noAck: false });
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] getJob error: ${error}`);
      // back to queue
      this.queueChannel.nack(tmpMsg);
      return Promise.reject(error);
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

  async setJobCallback(res) {
    this.logger.debug(`[${this.constructor.name}] setJobCallback(${res})`);
    try {
      const strRes = JSON.stringify(res);
      const bufRes = Buffer.from(strRes);
      await this.queueChannel.sendToQueue(this.jobCallback, bufRes, { persistent: true });
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] setJobCallback() error:`, error);
      return Promise.reject(error);
    }
  }

  async parseTx() {
    // need override
    const res = {};
    await this.setJobCallback(res);
    return Promise.resolve();
  }

  async parsePendingTransaction() {
    // need override
    return Promise.resolve();
  }
}

module.exports = ParserBase;
