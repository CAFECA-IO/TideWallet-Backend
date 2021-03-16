const dvalue = require('dvalue');
const { v4: uuidv4 } = require('uuid');
const BigNumber = require('bignumber.js');

const CrawlerManagerBase = require('./CrawlerManagerBase');
const Utils = require('./Utils');

class EthCrawlerManagerBase extends CrawlerManagerBase {
  constructor(blockchainId, database, logger) {
    super(blockchainId, database, logger);
    this.options = {};
    this.syncInterval = 15000;
  }

  async init() {
    await super.init();
    this.peerBlock = 0;
    try {
      this.oneCycle();
    } catch (error) {
      this.logger.log(`[${this.constructor.name}] ${error}`);
    }
    setInterval(async () => {
      try {
        this.oneCycle();
      } catch (error) {
        this.logger.log(`[${this.constructor.name}] ${error}`);
      }
    }, this.syncInterval);
  }

  async assignParser() {
    // TODO
    return Promise.resolve();
  }

  async avgFeeFromPeer() {
    this.logger.debug(`[${this.constructor.name}] avgFeeFromPeer`);
    const type = 'getFee';
    const options = dvalue.clone(this.options);
    options.data = this.constructor.cmd({ type });
    const checkId = options.data.id;
    const data = await Utils.ETHRPC(options);
    if (data instanceof Object) {
      if (data.id !== checkId) {
        this.logger.error(`[${this.constructor.name}] avgFeeFromPeer not found`);
        return Promise.reject();
      }
      if (data.result) {
        const bnGasPrice = new BigNumber(data.result, 16);
        return Promise.resolve(bnGasPrice.toFixed());
      }
    }
    this.logger.error(`[${this.constructor.name}] avgFeeFromPeer not found`);
    return Promise.reject(data.error);
  }

  async blockNumberFromPeer() {
    this.logger.debug(`[${this.constructor.name}] blockNumberFromPeer`);
    const type = 'getBlockcount';
    const options = dvalue.clone(this.options);
    options.data = this.constructor.cmd({ type });
    const checkId = options.data.id;
    const data = await Utils.ETHRPC(options);
    if (data instanceof Object) {
      if (data.id !== checkId) {
        this.logger.error(`[${this.constructor.name}] \x1b[1m\x1b[90mblock number not found\x1b[0m\x1b[21m`);
        return Promise.reject();
      }
      return Promise.resolve(data.result);
    }
    this.logger.error(`[${this.constructor.name}]\x1b[1m\x1b[90m block number not found\x1b[0m\x1b[21m`);
    return Promise.reject();
  }

  async blockDataFromPeer(block) {
    this.logger.debug(`[${this.constructor.name}] blockDataFromPeer(${block})`);
    const type = 'getBlock';
    const options = dvalue.clone(this.options);
    options.data = this.constructor.cmd({ type, block });
    const checkId = options.data.id;
    const data = await Utils.ETHRPC(options);
    if (data instanceof Object) {
      if (data.id !== checkId) {
        this.logger.error(`[${this.constructor.name}] \x1b[1m\x1b[90mblock data not found\x1b[0m\x1b[21m`);
        return Promise.reject();
      }
      return Promise.resolve(data.result);
    }
    this.logger.error(`[${this.constructor.name}] \x1b[1m\x1b[90mblock data not found\x1b[0m\x1b[21m`);
    return Promise.reject();
  }

  async blockHashFromPeer(block) {
    this.logger.debug(`[${this.constructor.name}] blockhashFromPeer(${block})`);
    const type = 'getBlock';
    const options = dvalue.clone(this.options);
    options.data = this.constructor.cmd({ type, block });
    const checkId = options.data.id;
    const data = await Utils.ETHRPC(options);
    if (data instanceof Object) {
      if (data.id !== checkId) {
        this.logger.error(`[${this.constructor.name}] \x1b[1m\x1b[90mblock hash not found\x1b[0m\x1b[21m`);
        return Promise.reject();
      }
      const blockData = data.result;
      return Promise.resolve(blockData.hash);
    }
    this.logger.error(`[${this.constructor.name}] \x1b[1m\x1b[90mblock hash not found\x1b[0m\x1b[21m`);
    return Promise.reject();
  }

  async insertBlock(blockData) {
    this.logger.debug(`[${this.constructor.name}] insertBlock(${blockData.hash})`);

    try {
      const insertResult = await this.blockScannedModel.findOrCreate({
        where: { blockchain_id: this.bcid, block: parseInt(blockData.number, 16) },
        defaults: {
          blockchain_id: this.bcid,
          block: parseInt(blockData.number, 16),
          block_hash: blockData.hash,
          timestamp: parseInt(blockData.timestamp, 16),
          result: JSON.stringify(blockData),
        },
      });
      return insertResult;
    } catch (error) {
      const e = new Error(`[${this.constructor.name}] insertBlock(${blockData.hash}) error: ${error}`);
      this.logger.error(e);
      return Promise.reject(e);
    }
  }

  async insertUnparsedTransaction(transaction, receipt, timestamp) {
    this.logger.debug(`[${this.constructor.name}] insertUnparsedTransaction`);

    try {
      const insertResult = await this.unparsedTxModel.findOrCreate({
        where: { blockchain_id: this.bcid, txid: transaction.hash },
        defaults: {
          blockchain_id: this.bcid,
          txid: transaction.hash,
          transaction: JSON.stringify(transaction),
          receipt: JSON.stringify(receipt),
          timestamp,
          retry: 0,
        },
      });
      return insertResult;
    } catch (error) {
      const e = new Error(`[${this.constructor.name}] insertUnparsedTransaction(${transaction.hash}) error: ${error}`);
      this.logger.error(e);
      return Promise.reject(e);
    }
  }

  async oneCycle() {
    try {
      if (this.isSyncing) return Promise.resolve('EthCrawlerManagerBase is sycning');
      this.isSyncing = true;
      // step
      // 1. blockNumberFromDB
      // 2. blockNumberFromPeer
      // 3. checkBlockNumber
      // 4. if equal wait to next cycle
      // 5. blockHashFromDB
      // 6. blockHashFromPeer
      // 7. checkBlockHash
      // 7-1 if not equal rollbackBlock
      // 8. syncNextBlock
      // 9. checkBlockNumber
      // 9-1. if is current block on peer, start sync pending transaction
      // 10. wait to next cycle

      if (!await this.checkBlockNumberLess()) {
        this.logger.log(`[${this.constructor.name}] block height ${this.dbBlock} is top now.`);
        this.isSyncing = false;
        if (!this.startSyncPendingTx) { this.startSyncPendingTx = true; }
        return Promise.resolve();
      }

      if (!await this.checkBlockHash(this.dbBlock)) {
        this.logger.log(`[${this.constructor.name}] block ${this.dbBlock} in db not the same as peer.`);
        // TODO
        // dbBlock = await this.rollbackBlock();
      }

      await this.syncBlock(this.dbBlock);

      if (!this.startSyncPendingTx && !await this.checkBlockNumberLess()) {
        this.startSyncPendingTx = true;
      }
      this.isSyncing = false;
      return Promise.resolve();
    } catch (error) {
      this.isSyncing = false;
      this.logger.error(error);
      return Promise.resolve();
    }
  }

  async pendingTransactionFromPeer() {
    this.logger.debug(`[${this.constructor.name}] pendingTransactionFromPeer`);
    try {
      const type = 'getPendingTxs';
      const options = dvalue.clone(this.options);
      options.data = this.constructor.cmd({ type });
      const checkId = options.data.id;
      const data = await Utils.ETHRPC(options);
      if (data instanceof Object) {
        if (data.id !== checkId) {
          this.logger.error(`[${this.constructor.name}] pendingTransactionFromPeer fail`);
          return null;
        }
        if (data.result) {
          return Promise.resolve(data.result.transactions);
        }
      }
      this.logger.error(`[${this.constructor.name}] pendingTransactionFromPeer fail, ${JSON.stringify(data.error)}`);
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] pendingTransactionFromPeer error: ${error}`);
      return Promise.reject(error);
    }
  }

  async syncAvgFee() {
    this.logger.debug(`[${this.constructor.name}] syncAvgFee`);
    try {
      const avgFee = await this.avgFeeFromPeer();
      await this.updateFee(avgFee);
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] syncAvgFee error ${error}`);
    }
  }

  async syncBlock(block) {
    // step
    // 1. sync block +1
    // 2. save block data into db
    // 3. sync tx and receipt
    // 4. save unparsed tx and receipt into db
    // 5. assign parser
    // 6. after parse done update blockchain table block column
    // 7. check block in db is equal to this.peerBlock
    // 8. if yes return
    // 9. if no, recursive

    try {
      let syncBlock = block;
      do {
        const step1 = new Date().getTime();
        // 1. sync block +1
        this.logger.debug(`[${this.constructor.name}] syncBlock(${syncBlock})`);
        syncBlock += 1;
        const syncResult = await this.blockDataFromPeer(syncBlock);
        if (!syncResult) {
          // block hash or data not found
          // maybe network error or block doesn't exist
          // end this recursive
          return Promise.resolve(syncBlock - 1);
        }
        const step1_1 = new Date().getTime();
        this.logger.log(`[${this.constructor.name}] syncBlock ${syncBlock} step:1 blockDataFromPeer: ${(step1_1 - step1) / 1000}sec`);

        // 2. save block data into db
        // must success
        await this.insertBlock(syncResult);
        const step2 = new Date().getTime();
        this.logger.log(`[${this.constructor.name}] syncBlock ${syncBlock} step:2 insertBlock: ${(step2 - step1_1) / 1000}sec`);

        // 3. sync tx and receipt
        const txs = syncResult.transactions;
        const timestamp = parseInt(syncResult.timestamp, 16);
        // slice job to speed up
        const requestsPerJob = 20;
        const insertTx = [];

        for (let i = 0; i < txs.length; i += requestsPerJob) {
          const transactions = txs.slice(i, i + requestsPerJob);
          const requests = [];
          for (const transaction of transactions) {
            const receipt = this.receiptFromPeer(transaction.hash);
            requests.push(receipt);
          }
          const step3_1 = new Date().getTime();
          const receipts = await Promise.all(requests).catch((error) => Promise.reject(error));
          const step3_2 = new Date().getTime();
          this.logger.log(`[${this.constructor.name}] syncBlock ${syncBlock} step:3_1 receiptFromPeer: ${(step3_2 - step3_1) / 1000}sec`);

          if (!requests || !receipts) {
            // TODO error handle
          }

          for (let j = 0; j < transactions.length; j++) {
            // check tx is not in db
            const findTX = await this.unparsedTxModel.findOne({
              where: { blockchain_id: this.bcid, txid: transactions[j].hash },
            });
            if (!findTX) {
              insertTx.push({
                blockchain_id: this.bcid,
                txid: transactions[j].hash,
                transaction: JSON.stringify(transactions[j]),
                receipt: JSON.stringify(receipts[j]),
                timestamp,
                retry: 0,
              });
            }
          }
          const step3_3 = new Date().getTime();
          this.logger.log(`[${this.constructor.name}] syncBlock ${syncBlock} step:3_2 find unparsed tx: ${(step3_3 - step3_2) / 1000}sec`);
        }
        // for (const transaction of txs) {
        //   const step3_1 = new Date().getTime();
        //   const receipt = await this.receiptFromPeer(transaction.hash);
        //   const step3_2 = new Date().getTime();
        //   this.logger.log(`[${this.constructor.name}] syncBlock ${syncBlock} step:3_1 receiptFromPeer: ${(step3_2 - step3_1) / 1000}sec`);

        //   if (!transaction || !receipt) {
        //     // TODO error handle
        //   }
        //   // 4. save unparsed tx and receipt into db
        //   await this.insertUnparsedTransaction(transaction, receipt, timestamp);
        //   const step4 = new Date().getTime();
        //   this.logger.log(`[${this.constructor.name}] syncBlock ${syncBlock} step:4 insertUnparsedTransaction: ${(step4 - step3_2) / 1000}sec`);
        // }

        const step3 = new Date().getTime();
        this.logger.log(`[${this.constructor.name}] syncBlock ${syncBlock} step:3 full tx receipt sync: ${(step3 - step2) / 1000}sec`);

        // 4. save unparsed tx and receipt into db
        await this.unparsedTxModel.bulkCreate(insertTx);
        const step4 = new Date().getTime();
        this.logger.log(`[${this.constructor.name}] syncBlock ${syncBlock} step:4 insertUnparsedTransaction: ${(step4 - step3) / 1000}sec`);
        // 5. assign parser
        // must success

        // 6. after parse done update blockchain table block column
        await this.updateBlockHeight(syncBlock);
        const step6 = new Date().getTime();
        this.logger.log(`[${this.constructor.name}] syncBlock ${syncBlock} step:6 updateBlockHeight: ${(step6 - step3) / 1000}sec`);

        this.logger.log(`[${this.constructor.name}] syncBlock ${syncBlock} total receipts sync: ${txs.length}`);
        this.logger.log(`[${this.constructor.name}] syncBlock ${syncBlock} whole: ${(step6 - step1) / 1000}sec`);
      } while (syncBlock < this.peerBlock);
      return Promise.resolve(syncBlock);
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] syncBlock() error: ${error}`);
      return Promise.reject();
    }
  }

  async receiptFromPeer(txid) {
    this.logger.debug(`[${this.constructor.name}] receiptFromPeer(${txid})`);
    const type = 'getReceipt';
    const options = dvalue.clone(this.options);
    options.data = this.constructor.cmd({ type, txid });
    const checkId = options.data.id;
    const data = await Utils.ETHRPC(options);
    if (data instanceof Object) {
      if (data.id !== checkId) {
        this.logger.error(`[${this.constructor.name}] \x1b[1m\x1b[90mreceipt not found\x1b[0m\x1b[21m`);
        return Promise.reject();
      }
      return Promise.resolve(data.result);
    }
    this.logger.error(`[${this.constructor.name}] \x1b[1m\x1b[90mreceipt not found\x1b[0m\x1b[21m`);
    return Promise.reject();
  }

  async transactionFromPeer(txid) {
    this.logger.debug(`[${this.constructor.name}] transactionFromPeer(${txid})`);
    const type = 'getTransaction';
    const options = dvalue.clone(this.options);
    options.data = this.constructor.cmd({ type, txid });
    const checkId = options.data.id;
    const data = await Utils.ETHRPC(options);
    if (data instanceof Object) {
      if (data.id !== checkId) {
        this.logger.error(`[${this.constructor.name}] \x1b[1m\x1b[90mtransaction not found\x1b[0m\x1b[21m`);
        return Promise.reject();
      }
      return Promise.resolve(data.result);
    }
    this.logger.error(`[${this.constructor.name}] \x1b[1m\x1b[90mtransaction not found\x1b[0m\x1b[21m`);
    return Promise.reject();
  }

  async updateBlockHeight(block) {
    this.logger.debug(`[${this.constructor.name}] updateBlockHeight(${block})`);
    const insertResult = await this.blockchainModel.update(
      { block },
      { where: { blockchain_id: this.bcid } },
    );
    return insertResult;
  }

  async updatePendingTransaction() {
    this.logger.debug(`[${this.constructor.name}] updatePendingTransaction`);
    try {
      const pendingTxs = await this.pendingTransactionFromPeer();
      const result = await this.pendingTransactionModel.create({
        blockchain_id: this.bcid,
        transactions: JSON.stringify(pendingTxs),
        timestamp: Math.floor(Date.now() / 1000),
      });
      return result[0];
    } catch (error) {
      this.logger.debug(`[${this.constructor.name}] updatePendingTransaction error: ${error}`);
      return Promise.reject(error);
    }
  }

  static cmd({
    type, block, txid,
  }) {
    let result;
    switch (type) {
      case 'getBlockcount':
        result = {
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: dvalue.randomID(),
        };
        break;
      case 'getBlock':
        result = {
          jsonrpc: '2.0',
          method: 'eth_getBlockByNumber',
          params: [`0x${block.toString(16)}`, true],
          id: dvalue.randomID(),
        };
        break;
      case 'getFee':
        result = {
          jsonrpc: '2.0',
          method: 'eth_gasPrice',
          params: [],
          id: dvalue.randomID(),
        };
        break;
      case 'getTransaction':
        result = {
          jsonrpc: '2.0',
          method: 'eth_getTransactionByHash',
          params: [txid],
          id: dvalue.randomID(),
        };
        break;
      case 'getReceipt':
        result = {
          jsonrpc: '2.0',
          method: 'eth_getTransactionReceipt',
          params: [txid],
          id: dvalue.randomID(),
        };
        break;
      case 'getPendingTxs':
        result = {
          jsonrpc: '2.0',
          method: 'eth_getBlockByNumber',
          params: [
            'pending',
            true,
          ],
          id: dvalue.randomID(),
        };
        break;
      default:
        result = {};
    }
    return result;
  }
}

module.exports = EthCrawlerManagerBase;
