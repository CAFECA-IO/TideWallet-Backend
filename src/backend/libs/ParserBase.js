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

    this.amqpHost = this.config.rabbitmq.host;
  }

  async init() {
    this.currencyInfo = await this.getCurrencyInfo();
    this.maxRetry = 3;
    try {
      this.queueConnect = await amqp.connect(this.amqpHost);
      this.queueChannel = await this.queueConnect.createChannel();
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] init amqp error: ${error}`);
      process.exit(1);
    }
    this.queueConnect.on('error', (err) => { throw err; });
    this.queueConnect.on('close', () => { throw new Error(`[${this.constructor.name}] amqp channel close`); });
    this.queueChannel.on('error', (err) => { throw err; });
    this.queueChannel.on('close', () => { throw new Error(`[${this.constructor.name}] amqp channel close`); });
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
    this.logger.debug(`[${this.constructor.name}] blockDataFromDB`);
    try {
      const result = await this.blockScannedModel.findOne({
        where: { blockchain_id: this.bcid, block_hash },
      });
      return result;
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] blockDataFromDB error ${error}`);
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

  async setAddressTransaction(accountAddress_id, transaction_id, amount, direction, address) {
    this.logger.debug(`[${this.constructor.name}] setAddressTransaction(${accountAddress_id}, ${transaction_id}, ${direction})`);
    try {
      const result = await this.addressTransactionModel.create({
        currency_id: this.currencyInfo.currency_id,
        accountAddress_id,
        transaction_id,
        amount,
        direction,
        address,
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
