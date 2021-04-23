const BigNumber = require('bignumber.js');
const ParserManagerBase = require('./ParserManagerBase');
const Utils = require('./Utils');
const Fcm = require('./Fcm');

class EthParserManagerBase extends ParserManagerBase {
  constructor(blockchainId, config, database, logger) {
    super(blockchainId, config, database, logger);

    this.receiptModel = this.database.db.Receipt;
    this.tokenTransactionModel = this.database.db.TokenTransaction;
    this.addressTokenTransactionModel = this.database.db.AddressTokenTransaction;
    this.options = {};
    this.syncInterval = config.syncInterval.pending ? config.syncInterval.pending : 15000;

    this.jobTimeout = 15 * 1000; // 15 sec
    this.decimal = 18;
  }

  async init() {
    await super.init();
    this.isParsing = false;
    setInterval(async () => {
      await this.doParse();
    }, this.syncInterval);

    this.doParse();

    this.fcm = Fcm.getInstance({ logger: console });
    return this;
  }

  async createJob() {
    this.logger.debug(`[${this.constructor.name}] createJob`);
    if (!this.startParse) return;
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
    if (!this.startParse) return;
    // 3. update failed unparsed retry
    // 4. remove parsed transaction from UnparsedTransaction table
    // 5. update pendingTransaction
    // 6. update block reward
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

      // 6. update block reward
      if (successParsedTxs.length > 0) {
        // https://ethereum.stackexchange.com/questions/76259/how-to-know-the-current-block-reward-in-ethereum
        // NOTICE static may change!!!!
        // static = 2
        // uncleReward = (numbersOfUncle) * (static/32)
        // reward = static + fee + uncleReward
        try {
          const staticReward = new BigNumber(Utils.multipliedByDecimal(2, this.decimal));
          const tx = JSON.parse(successParsedTxs[0].transaction);
          const block = parseInt(tx.blockNumber, 16);
          const totalFee = await this.getTotalFee(block);
          const numbersOfUncle = await this.getUnclesCount(block);
          // if find
          if (totalFee.gte(new BigNumber(0)) && numbersOfUncle.gte(new BigNumber(0))) {
            const uncleReward = numbersOfUncle.multipliedBy(staticReward).dividedBy(32);
            const reward = staticReward.plus(totalFee).plus(uncleReward);
            await this.updateBlockReward(block, reward.toFixed());
          }
        } catch (error) {
          this.logger.error(`[${this.constructor.name}] update block reward error: ${error}`);
        }
      }

      this.createJob();
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] doJobDone error: ${error}`);
      this.isParsing = false;
      return Promise.resolve();
    }
  }

  async doParse() {
    if (!this.startParse) {
      this.logger.log(`[${this.constructor.name}] doParse is stop`);
      return;
    }
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

  async getTotalFee(block) {
    this.logger.debug(`[${this.constructor.name}] getTotalFee(${block})`);
    try {
      const txs = await this.transactionModel.findAll({
        where: { currency_id: this.currencyInfo.currency_id, block },
        attributes: {
          include: ['fee'],
        },
      });
      if (txs && txs.length > 0) {
        let total = new BigNumber(0);
        for (const tx of txs) {
          const bnFee = new BigNumber(tx.fee);
          total = total.plus(bnFee);
        }
        return total;
      }
      return new BigNumber(-1);
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] getTotalFee(${block}) error: ${error}`);
      return new BigNumber(-1);
    }
  }

  async getUnclesCount(block) {
    this.logger.debug(`[${this.constructor.name}] getUnclesCount(${block})`);
    try {
      const result = await this.blockScannedModel.findOne({
        where: { blockchain_id: this.bcid, block },
        attributes: {
          include: ['uncles'],
        },
      });
      if (result) {
        const uncles = JSON.parse(result.uncles);
        return new BigNumber(uncles.length);
      }
      return new BigNumber(-1);
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] getUnclesCount(${block}) error: ${error}`);
      return new BigNumber(-1);
    }
  }

  async updateBalance() {
    this.logger.debug(`[${this.constructor.name}] updateBalance`);
    // do in api
    return Promise.resolve();
  }

  async updateBlockReward(block, reward) {
    this.logger.debug(`[${this.constructor.name}] updateBlockReward(${block}, ${reward})`);
    try {
      await this.blockScannedModel.update({
        block_reward: reward,
      }, {
        where: { blockchain_id: this.bcid, block },
      });
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] updateBlockReward(${block}, ${reward}) error: ${error}`);
      throw error;
    }
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
          let _result = false;
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
            _result = true;
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
            _result = false;
          }

          const findAddressTransaction = await this.addressTransactionModel.findOne({
            include: [
              {
                model: this.transactionModel,
                attributes: ['transaction_id', 'txid', 'currency_id'],
                where: {
                  currency_id: this.currencyInfo.currency_id,
                  txid: tx.txid,
                },
              },
              {
                model: this.accountAddressModel,
                attributes: ['account_id', 'user_id'],
                include: [
                  {
                    model: this.accountModel,
                    attributes: ['blockchain_id'],
                  },
                ],
              },
            ],
            attributes: ['addressTransaction_id', 'currency_id', 'transaction_id'],
          });
          if (findAddressTransaction) {
            // fcm confirmations update
            const findAccountCurrency = await this.accountCurrencyModel.findOne({
              where: {
                account_id: findAddressTransaction.AccountAddress.account_id,
                currency_id: this.currencyInfo.currency_id,
              },
              attributes: ['accountCurrency_id'],
            });

            if (findAccountCurrency) {
              await this.fcm.messageToUserTopic(findAddressTransaction.AccountAddress.user_id, {
                blockchainId: findAddressTransaction.AccountAddress.Account.blockchain_id,
                eventType: 'TRANSACTION',
                currencyId: this.currencyInfo.currency_id,
                data: {
                  account_id: findAccountCurrency.accountCurrency_id,
                  txid: tx.txid,
                  result: _result,
                },
              });
            }
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
