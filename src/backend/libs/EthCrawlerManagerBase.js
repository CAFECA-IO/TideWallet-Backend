const dvalue = require('dvalue');
const { v4: uuidv4 } = require('uuid');

const CrawlerManagerBase = require('./CrawlerManagerBase');
const Utils = require('./Utils');

class EthCrawlerManagerBase extends CrawlerManagerBase {
  constructor(blockchainId, database, logger) {
    super(blockchainId, database, logger);
    this.options = {};
    this.syncInterval = 15000;
    this.unparsedTxModel = this.database.db.UnparsedTransaction;
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

  async blockNumberFromPeer() {
    this.logger.log(`[${this.constructor.name}] blockNumberFromPeer`);
    const type = 'getBlockcount';
    const options = dvalue.clone(this.options);
    options.data = this.constructor.cmd({ type });
    const checkId = options.data.id;
    const data = await Utils.ETHRPC(options);
    console.log(data);
    if (data instanceof Object) {
      if (data.id !== checkId) {
        this.logger.log(`[${this.constructor.name}] \x1b[1m\x1b[90mblock number not found\x1b[0m\x1b[21m`);
        return Promise.reject();
      }
      return Promise.resolve(data.result);
    }
    this.logger.log(`[${this.constructor.name}]\x1b[1m\x1b[90m block number not found\x1b[0m\x1b[21m`);
    return Promise.reject();
  }

  async blockDataFromPeer(blockHash) {
    this.logger.log(`[${this.constructor.name}] blockDataFromPeer(${blockHash})`);
    const type = 'getBlock';
    const options = dvalue.clone(this.options);
    options.data = this.constructor.cmd({ type, blockHash });
    const checkId = options.data.id;
    const data = await Utils.ETHRPC(options);
    if (data instanceof Object) {
      if (data.id !== checkId) {
        this.logger.log(`[${this.constructor.name}] \x1b[1m\x1b[90mblock data not found\x1b[0m\x1b[21m`);
        return Promise.reject();
      }
      return Promise.resolve(data.result);
    }
    this.logger.log(`[${this.constructor.name}] \x1b[1m\x1b[90mblock data not found\x1b[0m\x1b[21m`);
    return Promise.reject();
  }

  async blockHashFromPeer(block) {
    this.logger.log(`[${this.constructor.name}] blockhashFromPeer(${block})`);
    const type = 'getBlockhash';
    const options = dvalue.clone(this.options);
    options.data = this.constructor.cmd({ type, block });
    const checkId = options.data.id;
    const data = await Utils.ETHRPC(options);
    if (data instanceof Object) {
      if (data.id !== checkId) {
        this.logger.log(`[${this.constructor.name}] \x1b[1m\x1b[90mblock hash not found\x1b[0m\x1b[21m`);
        return Promise.reject();
      }
      const blockData = data.result;
      return Promise.resolve(blockData.hash);
    }
    this.logger.log(`[${this.constructor.name}] \x1b[1m\x1b[90mblock hash not found\x1b[0m\x1b[21m`);
    return Promise.reject();
  }

  async insertBlock(blockData) {
    this.logger.log(`[${this.constructor.name}] insertBlock(${blockData.hash})`);
    this.logger.log(`[${this.constructor.name}] this.bcid: ${this.bcid}`);
    this.logger.log(`[${this.constructor.name}] blockData.number: ${blockData.number}`);

    try {
      const insertResult = await this.blockScannedModel.findOrCreate({
        where: { blockchain_id: this.bcid, block: parseInt(blockData.number, 16) },
        defaults: {
          blockScanned_id: uuidv4(),
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
      this.logger.log(e);
      return Promise.reject(e);
    }
  }

  async insertUnparsedTransaction(transaction, receipt, timestamp) {
    this.logger.log(`[${this.constructor.name}] insertUnparsedTransaction`);
    this.logger.log(`[${this.constructor.name}] transaction: ${transaction}`);
    this.logger.log(`[${this.constructor.name}] receipt: ${receipt}`);
    this.logger.log(`[${this.constructor.name}] timestamp: ${timestamp}`);

    try {
      const insertResult = await this.unparsedTxModel.findOrCreate({
        where: { blockchain_id: this.bcid, txid: transaction.hash },
        defaults: {
          unparsedTransaction_id: uuidv4(),
          blockchain_id: this.bcid,
          txid: transaction.hash,
          transaction: JSON.stringify(transaction),
          receipt: JSON.stringify(receipt),
          timestamp,
        },
      });
      return insertResult;
    } catch (error) {
      const e = new Error(`[${this.constructor.name}] insertUnparsedTransaction(${transaction.hash}) error: ${error}`);
      this.logger.log(e);
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
      // 9. updateBalance
      // 10. wait to next cycle

      const dbBlock = await this.blockNumberFromDB();
      this.peerBlock = await this.blockNumberFromPeer();
      if (!await this.checkBlockNumberLess()) {
        this.logger.log(`[${this.constructor.name}] block height ${dbBlock} is top now.`);
        this.isSyncing = false;
        return Promise.resolve();
      }

      if (!await this.checkBlockHash(dbBlock)) {
        this.logger.log(`[${this.constructor.name}] block ${dbBlock} in db not the same as peer.`);
        // TODO
        // dbBlock = await this.rollbackBlock();
      }

      await this.syncBlock(dbBlock);

      await this.updateBalance();

      this.isSyncing = false;
      return Promise.resolve();
    } catch (error) {
      this.isSyncing = false;
      this.logger.log(error);
      return Promise.resolve();
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
        // 1. sync block +1
        this.logger.log(`[${this.constructor.name}] syncBlock(${syncBlock})`);
        syncBlock += 1;
        const syncBlockHash = await this.blockHashFromPeer(syncBlock);
        const syncResult = await this.blockDataFromPeer(syncBlockHash);
        if (!syncBlockHash || !syncResult) {
          // block hash or data not found
          // maybe network error or block doesn't exist
          // end this recursive
          return Promise.resolve(syncBlock - 1);
        }

        // 2. save block data into db
        // must success
        await this.insertBlock(syncResult);

        // 3. sync tx and receipt
        const txids = syncResult.transactions;
        const timestamp = parseInt(syncResult.timestamp, 16);
        for (const txid of txids) {
          const transaction = await this.transactionFromPeer(txid);
          const receipt = await this.receiptFromPeer(txid);

          if (!transaction || !receipt) {
            // TODO error handle
          }
          // 4. save unparsed tx and receipt into db
          await this.insertUnparsedTransaction(transaction, receipt, timestamp);
        }

        // 5. assign parser
        // must success

        // 6. after parse done update blockchain table block column
        await this.updateBlockHeight(syncBlock);
      } while (syncBlock < this.peerBlock);
      return Promise.resolve(syncBlock);
    } catch (error) {
      this.logger.log(`[${this.constructor.name}] syncBlock() error: ${error}`);
      return Promise.reject();
    }
  }

  async receiptFromPeer(txid) {
    this.logger.log(`[${this.constructor.name}] receiptFromPeer(${txid})`);
    const type = 'getReceipt';
    const options = dvalue.clone(this.options);
    options.data = this.constructor.cmd({ type, txid });
    const checkId = options.data.id;
    const data = await Utils.ETHRPC(options);
    if (data instanceof Object) {
      if (data.id !== checkId) {
        this.logger.log(`[${this.constructor.name}] \x1b[1m\x1b[90mreceipt not found\x1b[0m\x1b[21m`);
        return Promise.reject();
      }
      return Promise.resolve(data.result);
    }
    this.logger.log(`[${this.constructor.name}] \x1b[1m\x1b[90mreceipt not found\x1b[0m\x1b[21m`);
    return Promise.reject();
  }

  async transactionFromPeer(txid) {
    this.logger.log(`[${this.constructor.name}] transactionFromPeer(${txid})`);
    const type = 'getTransaction';
    const options = dvalue.clone(this.options);
    options.data = this.constructor.cmd({ type, txid });
    const checkId = options.data.id;
    const data = await Utils.ETHRPC(options);
    if (data instanceof Object) {
      if (data.id !== checkId) {
        this.logger.log(`[${this.constructor.name}] \x1b[1m\x1b[90mtransaction not found\x1b[0m\x1b[21m`);
        return Promise.reject();
      }
      return Promise.resolve(data.result);
    }
    this.logger.log(`[${this.constructor.name}] \x1b[1m\x1b[90mtransaction not found\x1b[0m\x1b[21m`);
    return Promise.reject();
  }

  async updateBalance() {
    // TODO
    return Promise.resolve();
  }

  async updateBlockHeight(block) {
    this.logger.log(`[${this.constructor.name}] updateBlockHeight(${block})`);
    const insertResult = await this.blockchainModel.update(
      { block },
      { where: { blockchain_id: this.bcid } },
    );
    return insertResult;
  }

  static cmd({
    type, block, blockHash, txid,
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
      case 'getBlockhash':
        result = {
          jsonrpc: '2.0',
          method: 'eth_getBlockByNumber',
          params: [`0x${block.toString(16)}`, false],
          id: dvalue.randomID(),
        };
        break;
      case 'getBlock':
        result = {
          jsonrpc: '2.0',
          method: 'eth_getBlockByHash',
          params: [blockHash, false],
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
      default:
        result = {};
    }
    return result;
  }
}

module.exports = EthCrawlerManagerBase;
