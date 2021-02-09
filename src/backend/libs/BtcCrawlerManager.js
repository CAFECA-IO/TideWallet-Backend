const dvalue = require('dvalue');
const { v4: uuidv4 } = require('uuid');

const CrawlerManagerBase = require('./CrawlerManagerBase')
const Utils = require('./Utils');

class BtcCrawlerManager extends CrawlerManagerBase {
  constructor(config, database, logger) {
    super('Bitcoin', config, database, logger);
  }

  async init() {
    this.options = this.config.bitcoin;
    this.peerBlock = 0;
    this.bcid = await this.blockchainId();
    //**** for test function ****
    this.blockNumberFromPeer()
    .then(bNum => {this.logger.log(`blockNumberFromPeer: ${bNum}`); return bNum})
    .then(bNum => this.blockhashFromPeer(bNum))
    .then(bHash => {this.logger.log(`blockhashFromPeer: ${bHash}`); return bHash})
    .then(bHash => this.blockDataFromPeer(bHash))
    // .then(bData => {this.logger.log(`blockDataFromPeer: ${JSON.stringify(bData)}`); return bData})
    .then(bData => this.insertBlock(bData))
    // .then(saveResult => {this.logger.log(`save result:`, JSON.stringify(saveResult)); return saveResult})
    .then(r => this.updateBlockHeight(20))
    .catch(e => this.logger.log(`something wrong, error: ${e}`))
    //**** for test function done ****
  }

  blockNumberFromPeer() {
    this.logger.log('blockNumberFromPeer');
    const type = 'getblockcount';
    const options = dvalue.clone(this.options);
    options.data = this.constructor.cmd({ type });
    const checkId = options.data.id;
    return Utils.BTCRPC(options)
      .then((data) => {
        if (data instanceof Object) {
          if (data.id !== checkId) return Promise.reject();
          return Promise.resolve(data.result);
        }
        this.logger.log(`\x1b[1m\x1b[90mbtc block number not found\x1b[0m\x1b[21m`);
        return Promise.reject();
      })
  }

  blockDataFromPeer(blockHash) {
    this.logger.log(`blockDataFromPeer(${blockHash})`);
    const type = 'getblock';
    const options = dvalue.clone(this.options);
    options.data = this.constructor.cmd({ type, blockHash });
    const checkId = options.data.id;
    return Utils.BTCRPC(options)
      .then((data) => {
        if (data instanceof Object) {
          if (data.id !== checkId) return Promise.reject();
          return Promise.resolve(data.result);
        }
        this.logger.log(`\x1b[1m\x1b[90mbtc block hash not found\x1b[0m\x1b[21m`);
        return Promise.reject();
      })
  }

  blockhashFromPeer(block) {
    this.logger.log(`blockhashFromPeer(${block})`);
    const type = 'getblockhash';
    const options = dvalue.clone(this.options);
    options.data = this.constructor.cmd({ type, block });
    const checkId = options.data.id;
    return Utils.BTCRPC(options)
      .then((data) => {
        if (data instanceof Object) {
          if (data.id !== checkId) return Promise.reject();
          return Promise.resolve(data.result);
        }
        this.logger.log(`\x1b[1m\x1b[90mbtc block hash not found\x1b[0m\x1b[21m`);
        return Promise.reject();
      })
  }

  async checkBlockNumber() {
    this.logger.log('checkBlockNumber');
    const dbBlockNumber = await this.blockNumberFromDB();
    const currentBlockNumber = this.blockNumberFromPeer();
    if (typeof dbBlockNumber !== 'number' || typeof currentBlockNumber !== 'number') {
      return Promise.reject();
    }
    return dbBlockNumber <= currentBlockNumber;
  }

  async checkBlockHash(block) {
    this.logger.log(`checkBlockHash(${block})`);
    const dbBlockHash = await this.blockHashFromDB(block);
    const peerBlockHash = await this.blockHashFromPeer(block);
    if (typeof block !== 'string' || typeof peerBlockHash !== 'string') {
      return Promise.reject();
    }

    return dbBlockHash === peerBlockHash;
  }

  async insertBlock(blockData) {
    this.logger.log(`insertBlock(${blockData.hash})`);
    this.logger.log(`this.bcid: ${this.bcid}`);
    this.logger.log(`blockData.height: ${blockData.height}`);

    const insertResult = await this.blockScannedModel.findOrCreate({
      where: { Blockchain_id: this.bcid, block: blockData.height },
      defaults: {
        BlockScanned_id: uuidv4(),
        Blockchain_id: this.bcid,
        block: blockData.height,
        block_hash: blockData.hash,
        timestamp: blockData.time,
        result: JSON.stringify(blockData)
      }
    });
    return insertResult;
  }

  async syncNextBlock(block) {
    this.logger.log(`syncNextBlock(current_block = ${block})`);
    // step
    // 1. sync block +1
    // 2. save block data into db
    // 3. assign parser
    // 4. after parse done update blockchain table block column
    // 5. check block in db is equal to this.peerBlock
    // 6. if yes return
    // 7. if no, recursive

    try {
      // 1. sync block +1
      const syncBlock = block + 1;
      const syncBlockHash = await this.blockhashFromPeer(syncBlock);
      const syncResult = await this.blockDataFromPeer(syncBlockHash);
      if (!syncBlockHash || !syncResult) {
        //block hash or data not found
        //maybe network error or block doesn't exist
        //end this recursive
        return Promise.resolve();
      }

      // 2. save block data into db
      // must success
      const BlockScanned_id = await this.insertBlock(syncResult);

      // 3. assign parser
      // must success

      // 4. after parse done update blockchain table block column
      const updateResult = await this.updateBlockHeight(syncBlock);

      // 5. check block in db is large than or equal to this.peerBlock
      if (syncBlock >= this.peerBlock) {
        // 6. if yes return
        return Promise.resolve();
      }
      // 7. if no, recursive
      return this.syncNextBlock(syncBlock);
    } catch (error) {
      this.logger.error(error);
      return Promise.reject();
    }
  }

  async updateBlockHeight(block) {
    this.logger.log(`updateBlockHeight(${block})`);
    const insertResult = await this.blockchainModel.update(
      { block },
      { where: { Blockchain_id: this.bcid } }
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
            params: [blockHash],
            id: dvalue.randomID(),
          };
          break;
    }
    return result;
  }

}

module.exports = BtcCrawlerManager;