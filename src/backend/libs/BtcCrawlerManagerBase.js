const dvalue = require('dvalue');
const { v4: uuidv4 } = require('uuid');

const CrawlerManagerBase = require('./CrawlerManagerBase');
const Utils = require('./Utils');

class BtcCrawlerManagerBase extends CrawlerManagerBase {
  constructor(blockchainId, database, logger) {
    super(blockchainId, database, logger);
    this.options = {};
    this.syncInterval = 90000;
  }

  async init() {
    await super.init();
    this.peerBlock = 0;
    try {
      this.oneCycle();
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] ${error}`);
    }
    setInterval(async () => {
      try {
        this.oneCycle();
      } catch (error) {
        this.logger.error(`[${this.constructor.name}] ${error}`);
      }
    }, this.syncInterval);
  }

  async assignParser() {
    // TODO
    return Promise.resolve();
  }

  async avgFeeFromPeer(block) {
    this.logger.debug(`[${this.constructor.name}] avgFeeFromPeer(${block})`);
    const type = 'getFee';
    const options = dvalue.clone(this.options);
    options.data = this.constructor.cmd({ type, block });
    const checkId = options.data.id;
    const data = await Utils.BTCRPC(options);
    if (data instanceof Object) {
      if (data.id !== checkId) {
        this.logger.error(`[${this.constructor.name}] avgFeeFromPeer not found`);
        return Promise.reject();
      }
      if (data.result) {
        const feerate50 = data.result.feerate_percentiles[2] || '1';
        return Promise.resolve(feerate50);
      }
    }
    this.logger.error(`[${this.constructor.name}] avgFeeFromPeer not found`);
    return Promise.reject(data.error);
  }

  async blockNumberFromPeer() {
    this.logger.debug(`[${this.constructor.name}] blockNumberFromPeer`);
    const type = 'getblockcount';
    const options = dvalue.clone(this.options);
    options.data = this.constructor.cmd({ type });
    const checkId = options.data.id;
    const data = await Utils.BTCRPC(options);
    if (data instanceof Object) {
      if (data.id !== checkId) return Promise.reject();
      return Promise.resolve(data.result);
    }
    this.logger.error('\x1b[1m\x1b[90mbtc block number not found\x1b[0m\x1b[21m');
    return Promise.reject();
  }

  async blockDataFromPeer(blockHash) {
    this.logger.debug(`[${this.constructor.name}] blockDataFromPeer(${blockHash})`);
    const type = 'getblock';
    const options = dvalue.clone(this.options);
    options.data = this.constructor.cmd({ type, blockHash });
    const checkId = options.data.id;
    const data = await Utils.BTCRPC(options);
    if (data instanceof Object) {
      if (data.id !== checkId) return Promise.reject();
      return Promise.resolve(data.result);
    }
    this.logger.error('\x1b[1m\x1b[90mbtc block data not found\x1b[0m\x1b[21m');
    return Promise.reject();
  }

  async blockHashFromPeer(block) {
    this.logger.debug(`[${this.constructor.name}] blockhashFromPeer(${block})`);
    const type = 'getblockhash';
    const options = dvalue.clone(this.options);
    options.data = this.constructor.cmd({ type, block });
    const checkId = options.data.id;
    const data = await Utils.BTCRPC(options);
    if (data instanceof Object) {
      if (data.id !== checkId) return Promise.reject();
      return Promise.resolve(data.result);
    }
    this.logger.error('\x1b[1m\x1b[90mbtc block hash not found\x1b[0m\x1b[21m');
    return Promise.reject();
  }

  async insertBlock(blockData) {
    try {
      this.logger.debug(`[${this.constructor.name}] insertBlock(${blockData.hash})`);

      const insertResult = await this.blockScannedModel.findOrCreate({
        where: { blockchain_id: this.bcid, block: blockData.height },
        defaults: {
          blockScanned_id: uuidv4(),
          blockchain_id: this.bcid,
          block: blockData.height,
          block_hash: blockData.hash,
          timestamp: blockData.time,
          result: JSON.stringify(blockData),
        },
      });
      return insertResult;
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] insertBlock(${blockData.hash}) error: ${error}`);
      return Promise.reject(error);
    }
  }

  async insertUnparsedTransaction(transaction, timestamp) {
    this.logger.debug(`[${this.constructor.name}] insertUnparsedTransaction`);

    try {
      const insertResult = await this.unparsedTxModel.findOrCreate({
        where: { blockchain_id: this.bcid, txid: transaction.hash },
        defaults: {
          blockchain_id: this.bcid,
          txid: transaction.txid,
          transaction: JSON.stringify(transaction),
          receipt: '',
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
      if (this.isSyncing) return Promise.resolve('BtcCrawlerManagerBase is sycning');
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

      if (!await this.checkBlockNumberLess()) {
        this.logger.log(`[${this.constructor.name}] block height ${this.dbBlock} is top now.`);
        this.isSyncing = false;
        return Promise.resolve();
      }

      if (!await this.checkBlockHash(this.dbBlock)) {
        this.logger.log(`[${this.constructor.name}] block ${this.dbBlock} in db not the same as peer.`);
        // TODO
        // dbBlock = await this.rollbackBlock();
      }

      await this.syncBlock(this.dbBlock);

      await this.updateBalance();

      this.isSyncing = false;
      return Promise.resolve();
    } catch (error) {
      this.isSyncing = false;
      return Promise.reject();
    }
  }

  async syncAvgFee() {
    this.logger.debug(`[${this.constructor.name}] syncAvgFee`);
    try {
      const block = await this.blockNumberFromDB();
      const avgFee = await this.avgFeeFromPeer(block);
      await this.updateFee(avgFee);
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] syncAvgFee error: ${error}`);
    }
  }

  async syncBlock(block) {
    // step
    // 1. sync block +1
    // 2. save block data into db
    // 3. save unparsed transaction into db
    // 4. assign parser
    // 5. after parse done update blockchain table block column
    // 6. check block in db is equal to this.peerBlock
    // 7. if yes return
    // 8. if no, recursive

    try {
      let syncBlock = block;
      do {
        // 1. sync block +1
        this.logger.debug(`[${this.constructor.name}] syncBlock(${syncBlock})`);
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

        // 3. save unparsed transaction into db
        const txs = syncResult.tx;
        const timestamp = syncResult.time;
        const insertTx = [];

        for (let j = 0; j < txs.length; j++) {
          // check tx is not in db
          const findTX = await this.unparsedTxModel.findOne({
            where: { blockchain_id: this.bcid, txid: txs[j].hash },
          });
          txs[j].blockhash = syncResult.hash;
          txs[j].confirmations = syncResult.confirmations;
          txs[j].blocktime = syncResult.time;
          txs[j].height = syncResult.height;
          if (!findTX) {
            insertTx.push({
              blockchain_id: this.bcid,
              txid: txs[j].txid,
              transaction: JSON.stringify(txs[j]),
              receipt: '',
              timestamp,
              retry: 0,
            });
          }
        }
        await this.unparsedTxModel.bulkCreate(insertTx);

        // 4. assign parser
        // must success

        // 5. after parse done update blockchain table block column
        await this.updateBlockHeight(syncBlock);
      } while (syncBlock < this.peerBlock);
      return Promise.resolve(syncBlock);
    } catch (error) {
      this.logger.error(error);
      return Promise.reject();
    }
  }

  async updateBalance() {
    // TODO
    return Promise.resolve();
  }

  async updateBlockHeight(block) {
    this.logger.debug(`[${this.constructor.name}] updateBlockHeight(${block})`);
    const insertResult = await this.blockchainModel.update(
      { block },
      { where: { blockchain_id: this.bcid } },
    );
    return insertResult;
  }

  static cmd({
    type, block, blockHash,
  }) {
    let result;
    switch (type) {
      case 'getblockcount':
        result = {
          jsonrpc: '1.0',
          method: 'getblockcount',
          params: [],
          id: dvalue.randomID(),
        };
        break;
      case 'getblockhash':
        result = {
          jsonrpc: '1.0',
          method: 'getblockhash',
          params: [block],
          id: dvalue.randomID(),
        };
        break;
      case 'getblock':
        result = {
          jsonrpc: '1.0',
          method: 'getblock',
          params: [blockHash, 2],
          id: dvalue.randomID(),
        };
        break;
      case 'getFee':
        result = {
          jsonrpc: '1.0',
          method: 'getblockstats',
          params: [block, ['feerate_percentiles']],
          id: dvalue.randomID(),
        };
        break;
      default:
        result = {};
    }
    return result;
  }
}

module.exports = BtcCrawlerManagerBase;
