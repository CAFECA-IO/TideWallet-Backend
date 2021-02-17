const { v4: uuidv4 } = require('uuid');

class CrawlerManagerBase {
  constructor(blockchainId, database, logger) {
    this.bcid = blockchainId;
    this.database = database;
    this.logger = logger;

    this.blockchainModel = this.database.db.Blockchain;
    this.blockScannedModel = this.database.db.BlockScanned;
    this.currencyModel = this.database.db.Currency;
    this.sequelize = this.database.db.sequelize;
  }

  async init() {
    this.isSyncing = false;
    return this;
  }

  async assignParser() {
    // need override
    return Promise.resolve();
  }

  async blockInfo() {
    // TODO
    // get blockchain_id, start block
    return Promise.resolve();
  }

  async blockNumberFromDB() {
    this.logger.log(`[${this.constructor.name}] blockNumberFromDB`);
    try {
      const result = await this.blockchainModel.findOne({
        where: { Blockchain_id: this.bcid },
      });
      return result.block;
    } catch (error) {
      this.logger.log(`[${this.constructor.name}] blockNumberFromDB error ${error}`);
      return 0;
    }
  }

  async blockHashFromDB(block) {
    this.logger.log(`[${this.constructor.name}] blockHashFromDB(${block})`);
    const result = await this.blockScannedModel.findOne({
      where: { Blockchain_id: this.bcid, block },
    });
    return result.block_hash;
  }

  async blockNumberFromPeer() {
    // need override
    return Promise.resolve();
  }

  async blockDataFromPeer(blockHash) {
    // need override
    return Promise.resolve();
  }

  async blockHashFromPeer(block) {
    // need override
    return Promise.resolve();
  }

  async checkBlockNumberLess() {
    this.logger.log(`[${this.constructor.name}] checkBlockNumberLess`);
    const dbBlockNumber = await this.blockNumberFromDB();
    let currentBlockNumber = await this.blockNumberFromPeer();
    this.logger.log(`[${this.constructor.name}] checkBlockNumberLess dbBlockNumber: ${dbBlockNumber}, currentBlockNumber: ${currentBlockNumber}`)
    if (typeof currentBlockNumber === 'string') {
      currentBlockNumber = parseInt(currentBlockNumber, 16);
    }
    if (typeof dbBlockNumber !== 'number' || typeof currentBlockNumber !== 'number') {
      return false;
    }
    return dbBlockNumber < currentBlockNumber;
  }

  async checkBlockHash(block) {
    try {
      this.logger.log(`[${this.constructor.name}] checkBlockHash(${block})`);
      const dbBlockHash = await this.blockHashFromDB(block);
      const peerBlockHash = await this.blockHashFromPeer(block);
      if (typeof dbBlockHash !== 'string' || typeof peerBlockHash !== 'string') {
        return false;
      }
  
      return dbBlockHash === peerBlockHash;
    } catch (error) {
      this.logger.log(`[${this.constructor.name}] checkBlockHash(${block}) error ${error}`)
      return false;
    }
  }

  async insertBlock(blockData) {
    this.logger.log(`[${this.constructor.name}] insertBlock(${blockData.hash})`);
    this.logger.log(`[${this.constructor.name}] this.bcid: ${this.bcid}`);
    this.logger.log(`[${this.constructor.name}] blockData.height: ${blockData.height}`);

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

  async oneCycle() {
    // need override
    return Promise.resolve();
  }

  async rollbackBlock() {
    // TODO
    this.logger.log(`rollbackBlock()`);
    return Promise.resolve();
  };
  
  async syncBlock(block) {
    // need override
    return Promise.resolve();
  }

  async updateBalance(){
    // need override
    return Promise.resolve();
  }
  
  async updateBlockHeight(block) {
    this.logger.log(`[${this.constructor.name}] updateBlockHeight(${block})`);
    const insertResult = await this.blockchainModel.update(
      { block },
      { where: { Blockchain_id: this.bcid } }
    );
    return insertResult;
  }
}

module.exports = CrawlerManagerBase;