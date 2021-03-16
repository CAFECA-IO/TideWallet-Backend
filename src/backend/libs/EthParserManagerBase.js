const BigNumber = require('bignumber.js');
const Web3 = require('web3');
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
    this.web3 = new Web3();
    setInterval(async () => {
      await this.doParse();
    }, this.syncInterval);

    this.doParse();
    return this;
  }

  async createJob() {
    this.logger.error(`[${this.constructor.name}] createJob`);
    // 1. load unparsed transactions per block from UnparsedTransaction
    // 2. check has unparsed transaction
    // 2-1. if no parse update balance
    // 2-2. if yes setJob
    try {
      // 1. load unparsed transactions per block from UnparsedTransaction
      this.block = await this.blockNumberFromDB();
      const txs = await this.getUnparsedTxs();

      // 2. check has unparsed transaction
      if (!txs || txs.length < 1) {
        // 2-1. if no parse update balance
        await this.updateBalance();
        this.isParsing = false;
      } else {
        this.jobLength = 0;
        this.jobDoneList = [];

        for (const tx of txs) {
          const transaction = JSON.parse(tx.transaction);
          const receipt = JSON.parse(tx.receipt);
          await this.setJob({
            unparsedTransaction_id: tx.unparsedTransaction_id, transaction, receipt, timestamp: tx.timestamp,
          });
        }
      }
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] createJob error: ${error}`);
      this.isParsing = false;
      return Promise.resolve(error);
    }
  }

  async doCallback(job) {
    // job = { success: bool, unparsedTransaction_id: number, retry: number }
    this.jobDoneList.push(job);
    if (this.jobDoneList.length === this.jobLength) {
      // 3. update failed unparsed retry
      // 4. remove parsed transaction from UnparsedTransaction table
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

        await this.createJob();
      } catch (error) {
        this.logger.error(`[${this.constructor.name}] doParse error: ${error}`);
        this.isParsing = false;
        return Promise.resolve();
      }
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

    await this.createJob();
  }

  async updateBalance() {
    this.logger.debug(`[${this.constructor.name}] updateBalance`);
    // step:
    // 1. update pending transaction
    try {
      await this.parsePendingTransaction();
    } catch (error) {
      this.logger.debug(`[${this.constructor.name}] updateBalance error: ${error}`);
      return Promise.reject(error);
    }
  }

  async parsePendingTransaction() {
    this.logger.debug(`[${this.constructor.name}] parsePendingTransaction`);
    // step:
    // 1. find all transaction where status is null(means pending transaction)
    // 2. get last pending transaction from pendingTransaction table
    // 3. create transaction which is not in step 1 array
    // 4. update result to false which is not in step 2 array
    try {
      // 1. find all transaction where status is null(means pending transaction)
      const transactions = await this.getTransactionsResultNull();

      // 2. get last pending transaction from pendingTransaction table
      const pendingTxs = await this.getPendingTransactionFromDB();

      // 3. create transaction which is not in step 1 array
      const newTxs = pendingTxs.filter((pendingTx) => transactions.every((transaction) => pendingTx.hash !== transaction.txid));
      for (const tx of newTxs) {
        try {
          const bnAmount = new BigNumber(tx.value, 16);
          const bnGasPrice = new BigNumber(tx.gasPrice, 16);
          const bnGas = new BigNumber(tx.gas, 16);
          const fee = bnGasPrice.multipliedBy(bnGas).toFixed();

          let txResult = await this.transactionModel.findOne({
            where: {
              currency_id: this.currencyInfo.currency_id,
              txid: tx.hash,
            },
          });
          if (!txResult) {
            this.logger.debug(`[${this.constructor.name}] parsePendingTransaction create transaction(${tx.hash})`);
            txResult = await this.transactionModel.create({
              currency_id: this.currencyInfo.currency_id,
              txid: tx.hash,
              source_addresses: tx.from,
              destination_addresses: tx.to ? tx.to : '',
              amount: bnAmount.toFixed(),
              note: tx.input,
              block: parseInt(tx.blockNumber, 16),
              nonce: parseInt(tx.nonce, 16),
              fee,
              gas_price: bnGasPrice.toFixed(),
            });
          } else {
            const updateResult = await this.transactionModel.update(
              {
                source_addresses: tx.from,
                destination_addresses: tx.to ? tx.to : '',
                amount: bnAmount.toFixed(),
                note: tx.input,
                block: parseInt(tx.blockNumber, 16),
                nonce: parseInt(tx.nonce, 16),
                gas_price: bnGasPrice.toFixed(),
              }, {
                where: {
                  currency_id: this.currencyInfo.currency_id,
                  txid: tx.hash,
                },
                returning: true,
              },
            );
            [, [txResult]] = updateResult;
          }
        } catch (error) {
          this.logger.debug(`[${this.constructor.name}] parsePendingTransaction create transaction(${tx.hash}) error: ${error}`);
        }
      }

      // 4. update result which is not in step 2 array
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
          this.logger.debug(`[${this.constructor.name}] parsePendingTransaction update failed transaction(${tx.hash}) error: ${error}`);
        }
      }
    } catch (error) {
      this.logger.debug(`[${this.constructor.name}] parsePendingTransaction`);
      return Promise.reject(error);
    }
  }
}

module.exports = EthParserManagerBase;
