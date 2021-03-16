const amqp = require('amqplib');

class ParserManagerBase {
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
    this.pendingTransactionModel = this.database.db.PendingTransaction;

    this.parsers = [];
    this.maxParsers = this.config.rabbitmq.maxParsers || 5;
    this.amqpHost = this.config.rabbitmq.host;
  }

  async init() {
    this.currencyInfo = await this.getCurrencyInfo();
    this.maxRetry = 3;
    this.queueChannel = await amqp.connect(this.amqpHost).then((conn) => conn.createChannel());
    this.jobQueue = `${this.bcid}ParseJob`;
    this.jobCallback = `${this.bcid}ParseJobCallback`;

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

  // eslint-disable-next-line no-unused-vars
  async doCallback(job) {
    // need override
    return Promise.resolve();
  }

  async getCurrencyInfo() {
    this.logger.debug(`[${this.constructor.name}] getCurrencyInfo`);
    try {
      const result = await this.currencyModel.findOne({
        where: { blockchain_id: this.bcid, type: 1 },
        attributes: ['currency_id'],
      });
      return result;
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] currencyModel error ${error}`);
      return {};
    }
  }

  async getJobCallback() {
    this.logger.debug(`[${this.constructor.name}] getJobCallback`);
    try {
      await this.queueChannel.assertQueue(this.jobCallback, { durable: true });
      this.queueChannel.prefetch(1);
      await this.queueChannel.consume(this.jobCallback, async (msg) => {
        const job = JSON.parse(msg.content.toString());

        // IMPORTENT!!! remove from queue
        this.queueChannel.ack(msg);

        await this.doCallback(job);
        return job;
      }, { noAck: false });
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] getJobJobCallback error: ${error}`);
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

  async setJob(job) {
    this.logger.debug(`[${this.constructor.name}] setJob()`);
    try {
      const strJob = JSON.stringify(job);
      const bufJob = Buffer.from(strJob);
      await this.queueChannel.assertQueue(this.jobQueue, { durable: true });

      await this.queueChannel.sendToQueue(this.jobQueue, bufJob, { persistent: true });
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] setJob() error:`, error);
      return Promise.reject(error);
    }
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

module.exports = ParserManagerBase;
