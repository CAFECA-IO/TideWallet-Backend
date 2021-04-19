const amqp = require('amqplib');

class ParserManagerBase {
  constructor(blockchainId, config, database, logger) {
    this.bcid = blockchainId;
    this.database = database;
    this.logger = logger;
    this.config = config;

    this.blockchainModel = this.database.Blockchain;
    this.blockScannedModel = this.database.BlockScanned;
    this.currencyModel = this.database.Currency;
    this.sequelize = this.database.sequelize;
    this.Sequelize = this.database.Sequelize;
    this.unparsedTxModel = this.database.UnparsedTransaction;

    this.transactionModel = this.database.Transaction;
    this.pendingTransactionModel = this.database.PendingTransaction;

    this.amqpHost = this.config.rabbitmq.host;
    this.jobTimeout = 10 * 60 * 1000; // 10 min
    this.jobTimer = null;
  }

  async init() {
    this.currencyInfo = await this.getCurrencyInfo();
    this.maxRetry = 3;

    // message queue
    this.queueChannel = await amqp.connect(this.amqpHost).then((conn) => conn.createChannel());
    this.queueChannel.prefetch(1);
    this.jobQueue = `${this.bcid}ParseJob`;
    this.jobCallback = `${this.bcid}ParseJobCallback`;

    // clear queue
    await this.queueChannel.assertQueue(this.jobQueue, { durable: true });
    await this.queueChannel.assertQueue(this.jobCallback, { durable: true });
    await this.queueChannel.purgeQueue(this.jobQueue);
    await this.queueChannel.purgeQueue(this.jobCallback);

    this.numberOfJobs = 0;
    this.jobDoneList = [];
    this.getJobCallback();
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

  createJobTimer() {
    if (!this.jobTimer) {
      return setTimeout(async () => {
        await this.queueChannel.purgeQueue(this.jobQueue);
        await this.queueChannel.purgeQueue(this.jobCallback);
        await this.doJobDone();
        this.jobTimer = null;
      }, this.jobTimeout);
    }
  }

  // eslint-disable-next-line no-unused-vars
  async doCallback(job) {
    this.isParsing = true;
    if (this.jobTimer) {
      clearTimeout(this.jobTimer);
      this.jobTimer = null;
    }
    // job = { ...UnparsedTransaction, success: bool }
    this.jobDoneList.push(job);
    if (this.jobDoneList.length === this.numberOfJobs) {
      await this.doJobDone();
    } else if (!this.jobTimer) {
      this.jobTimer = this.createJobTimer();
    }
  }

  async doJobDone() {
    // need override
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

  async getJobCallback() {
    this.logger.debug(`[${this.constructor.name}] getJobCallback`);
    let tmpMsg;
    try {
      await this.queueChannel.consume(this.jobCallback, async (msg) => {
        tmpMsg = msg;
        const job = JSON.parse(msg.content.toString());

        await this.doCallback(job);

        // IMPORTENT!!! remove from queue
        this.queueChannel.ack(msg);

        return job;
      }, { noAck: false });
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] getJobJobCallback error: ${error}`);
      // back to queue
      this.queueChannel.nack(tmpMsg);
      return Promise.reject(error);
    }
  }

  async getPendingTransactionFromDB() {
    this.logger.debug(`[${this.constructor.name}] getPendingTransactionFromDB`);
    try {
      const pending = await this.pendingTransactionModel.findOne({
        where: { blockchain_id: this.bcid, blockAsked: this.block },
      });

      if (pending && pending.transactions) {
        return JSON.parse(pending.transactions);
      }
      return [];
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
      const oldest = await this.unparsedTxModel.findOne({
        where: { blockchain_id: this.bcid, retry: { [Op.lt]: this.maxRetry } },
        order: [['timestamp', 'ASC']],
        attributes: ['timestamp'],
      });

      if (!oldest) {
        this.logger.log(`[${this.constructor.name}] getUnparsedTxs not found`);
        return [];
      }

      const result = await this.unparsedTxModel.findAll({
        where: { blockchain_id: this.bcid, timestamp: oldest.timestamp, retry: { [Op.lt]: this.maxRetry } },
      });
      return result;
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] getUnparsedTxs error ${error}`);
      return {};
    }
  }

  async setJob(job) {
    this.logger.debug(`[${this.constructor.name}] setJob()`);
    try {
      job.dataValues.currentBlock = this.block; // cause job is sequelize object, JSON.stringify only contain dataValues.
      const strJob = JSON.stringify(job);
      const bufJob = Buffer.from(strJob);

      await this.queueChannel.sendToQueue(this.jobQueue, bufJob, { persistent: true });

      this.numberOfJobs += 1;
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] setJob() error:`, error);
      return Promise.reject(error);
    }
  }

  async removeParsedTx(tx) {
    this.logger.debug(`[${this.constructor.name}] removeParsedTx(${tx.unparsedTransaction_id})`);
    try {
      await this.unparsedTxModel.destroy({
        where: { unparsedTransaction_id: tx.unparsedTransaction_id },
      });
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] removeParsedTx(${tx.unparsedTransaction_id}) error: ${error}`);
      return Promise.reject(error);
    }
  }

  async removePendingTransaction() {
    this.logger.debug(`[${this.constructor.name}] removePendingTransaction`);
    try {
      const res = await this.pendingTransactionModel.destroy({
        where: { blockchain_id: this.bcid, blockAsked: this.block },
      });
    } catch (error) {
      this.logger.debug(`[${this.constructor.name}] removePendingTransaction error: ${error}`);
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

module.exports = ParserManagerBase;
