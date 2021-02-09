const { v4: uuidv4 } = require('uuid');

class CrawlerManagerBase {
  constructor(blockchainName, config, database, logger) {
    this.blockchainName = blockchainName;
    this.config = config;
    this.database = database;
    this.logger = logger;

    this.blockchainModel = this.database.db.Blockchain;
    this.blockScannedModel = this.database.db.BlockScanned;
    this.currencyModel = this.database.db.Currency;
    this.sequelize = this.database.db.sequelize;
  }

  async init() {
    return this;
  }

  async blockchainId() {
    this.logger.log('blockchainId')
    const result = await this.blockchainModel.findOne({
      where: { name: this.blockchainName },
    });
    return result.Blockchain_id;
  }

  async blockNumberFromDB() {
    this.logger.log('blockNumberFromDB');
    try {
      const result = await this.blockchainModel.findOne({
        where: { blockchainId: this.bcid },
      });
      return result.block;
    } catch (error) {
      this.logger.log(error);
      return 0;
    }
  }

  async blockHashFromDB(block) {
    this.logger.log(`blockHashFromDB(${block})`);
    const result = await this.blockScannedModel.findOne({
      where: { blockchainId: this.bcid, block },
    });
    return result.block_hash;
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

  async updateBlockHeight(block) {
    this.logger.log(`updateBlockHeight(${block})`);
    const insertResult = await this.blockchainModel.update(
      { block },
      { where: { Blockchain_id: this.bcid } }
    );
    return insertResult;
  }

  async rollbackBlock() {
    this.logger.log(`rollbackBlock()`);
    return Promise.resolve();
  };

  blockNumberFromPeer() {
    return Promise.resolve();
  }

  blockDataFromPeer(blockHash) {
    return Promise.resolve();
  }

  blockhashFromPeer(block) {
    return Promise.resolve();
  }

  async checkBlockNumber() {
    return true;
  }

  async checkBlockHash(block) {
    return true;
  }
  
  async syncNextBlock(block) {
    return Promise.resolve();
  }
}

module.exports = CrawlerManagerBase;