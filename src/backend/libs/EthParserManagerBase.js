const ParserManagerBase = require('./ParserManagerBase');

class EthParserManagerBase extends ParserManagerBase {
  constructor(blockchainId, config, database, logger) {
    super(blockchainId, config, database, logger);

    this.receiptModel = this.database.db.Receipt;
    this.tokenTransactionModel = this.database.db.TokenTransaction;
    this.addressTokenTransactionModel = this.database.db.AddressTokenTransaction;
    this.options = {};
    this.syncInterval = config.syncInterval.pending ? config.syncInterval.pending : 15000;
  }

  async init() {
    await super.init();
    this.isParsing = false;
    setInterval(async () => {
      await this.doParse();
    }, this.syncInterval);

    this.doParse();
    return this;
  }

  async createJob() {
    this.logger.debug(`[${this.constructor.name}] createJob`);
    // 1. load unparsed transactions per block from UnparsedTransaction
    // 2. check has unparsed transaction
    // 2-1. if no parse update balance
    // 2-2. if yes setJob
    try {
      this.block = await this.blockNumberFromDB(); // used by pending transaction
      // 1. load unparsed transactions per block from UnparsedTransaction
      const txs = await this.getUnparsedTxs();

      // 2. check has unparsed transaction
      if (!txs || txs.length < 1) {
        // 2-1. if no parse update balance
        await this.updateBalance();
        this.isParsing = false;
      } else {
        this.jobDoneList = [];
        this.numberOfJobs = 0;

        for (const tx of txs) {
          await this.setJob(tx);
        }
        if (!this.jobTimer) {
          this.jobTimer = this.createJobTimer();
        }
      }
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] createJob error: ${error}`);
      this.isParsing = false;
      return Promise.resolve(error);
    }
  }

  async doJobDone() {
    this.logger.debug(`[${this.constructor.name}] doJobDone`);
    // 3. update failed unparsed retry
    // 4. remove parsed transaction from UnparsedTransaction table
    // 5. update pendingTransaction
    try {
      const successParsedTxs = this.jobDoneList.filter((tx) => tx.success === true);
      const failedList = this.jobDoneList.filter((tx) => tx.success === false);

      // 3. update failed unparsed retry
      for (const failedTx of failedList) {
        await this.updateRetry(failedTx);
      }

      // 4. remove parsed transaction from UnparsedTransaction table
      for (const tx of successParsedTxs) {
        await this.removeParsedTx(tx);
      }

      // 5. update pendingTransaction
      await this.parsePendingTransaction();

      this.createJob();
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] doJobDone error: ${error}`);
      this.isParsing = false;
      return Promise.resolve();
    }
  }

  async doParse() {
    if (this.isParsing) {
      this.logger.log(`[${this.constructor.name}] doParse is parsing`);
      return;
    }
    this.isParsing = true;
    // step:
    // 1. load unparsed transactions per block from UnparsedTransaction
    // 2. check has unparsed transaction
    // 2-1. if no parse update balance
    // 2-2. if yes setJob
    // 3. update failed unparsed retry
    // 4. remove parsed transaction from UnparsedTransaction table
    // 5. update pendingTransaction

    await this.createJob();
  }

  async updateBalance() {
    this.logger.debug(`[${this.constructor.name}] updateBalance`);
    // do in api
    return Promise.resolve();
  }

  async parsePendingTransaction() {
    this.logger.debug(`[${this.constructor.name}] parsePendingTransaction`);
    // step:
    // 1. find all transaction where status is null(means pending transaction)
    // 2. get last pending transaction from pendingTransaction table
    // 3. update result to false which is not in step 2 array
    // 4. remove pending transaction
    try {
      // 1. find all transaction where status is null(means pending transaction)
      const transactions = await this.getTransactionsResultNull();

      // 2. get last pending transaction from pendingTransaction table
      const pendingTxs = await this.getPendingTransactionFromDB();

      // 3. update result which is not in step 2 array
      const missingTxs = transactions.filter((transaction) => (pendingTxs.every((pendingTx) => pendingTx.hash !== transaction.txid) && this.block - transaction.block >= 6));
      for (const tx of missingTxs) {
        try {
          if (tx.block) {
            await this.transactionModel.update(
              {
                result: true,
              },
              {
                where: {
                  currency_id: this.currencyInfo.currency_id,
                  txid: tx.txid,
                },
              },
            );
          } else {
            await this.transactionModel.update(
              {
                result: false,
              },
              {
                where: {
                  currency_id: this.currencyInfo.currency_id,
                  txid: tx.txid,
                },
              },
            );
          }
        } catch (error) {
          this.logger.error(`[${this.constructor.name}] parsePendingTransaction update failed transaction(${tx.hash}) error: ${error}`);
        }
      }

      // 4. remove pending transaction
      await this.removePendingTransaction();
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] parsePendingTransaction error: ${error}`);
      return Promise.reject(error);
    }
  }
}

module.exports = EthParserManagerBase;
