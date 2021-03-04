const { v4: uuidv4 } = require('uuid');

class CrawlerManagerBase {
  constructor(blockchainId, database, logger) {
    this.bcid = blockchainId;
    this.database = database;
    this.logger = logger;

    this.accountModel = this.database.db.Account;
    this.accountCurrencyModel = this.database.db.AccountCurrency;
    this.accountAddressModel = this.database.db.AccountAddress;
    this.blockchainModel = this.database.db.Blockchain;
    this.blockScannedModel = this.database.db.BlockScanned;
    this.currencyModel = this.database.db.Currency;
    this.sequelize = this.database.db.sequelize;
    this.unparsedTxModel = this.database.db.UnparsedTransaction;
    this.pendingTransactionModel = this.database.db.PendingTransaction;
    this.feeSyncInterval = 3600000;
    this.pendingTxSyncInterval = 15000;
  }

  async init() {
    this.isSyncing = false;
    this.startSyncPendingTx = false;
    this.blockInfo = await this.getBlockInfo();
    if (this.blockInfo.start_block > this.blockInfo.block) {
      await this.updateBlockHeight(this.blockInfo.start_block);
    }
    setInterval(() => {
      this.syncAvgFee();
    }, this.feeSyncInterval);
    this.syncAvgFee();

    setInterval(() => {
      if (!this.startSyncPendingTx) return;
      this.updatePendingTransaction();
    }, this.pendingTxSyncInterval);
    return this;
  }

  async assignParser() {
    // need override
    return Promise.resolve();
  }

  async avgFeeFromPeer() {
    // need override
    return Promise.resolve();
  }

  async getBlockInfo() {
    this.logger.debug(`[${this.constructor.name}] getBlockInfo`);
    try {
      const result = await this.blockchainModel.findOne({
        where: { blockchain_id: this.bcid },
      });
      return result;
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] blockNumberFromDB error ${error}`);
      return {};
    }
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
      return 0;
    }
  }

  async blockHashFromDB(block) {
    this.logger.debug(`[${this.constructor.name}] blockHashFromDB(${block})`);
    const result = await this.blockScannedModel.findOne({
      where: { blockchain_id: this.bcid, block },
    });
    return result.block_hash;
  }

  async blockNumberFromPeer() {
    // need override
    return Promise.resolve();
  }

  // eslint-disable-next-line no-unused-vars
  async blockDataFromPeer(blockHash) {
    // need override
    return Promise.resolve();
  }

  // eslint-disable-next-line no-unused-vars
  async blockHashFromPeer(block) {
    // need override
    return Promise.resolve();
  }

  async checkBlockNumberLess() {
    this.logger.debug(`[${this.constructor.name}] checkBlockNumberLess`);
    this.dbBlock = await this.blockNumberFromDB();
    this.peerBlock = await this.blockNumberFromPeer();
    let intPeerBlock = this.peerBlock;
    if (typeof this.peerBlock === 'string') {
      intPeerBlock = parseInt(this.peerBlock, 16);
    }
    if (typeof this.dbBlock !== 'number' || typeof intPeerBlock !== 'number') {
      return false;
    }
    return this.dbBlock < intPeerBlock;
  }

  async checkBlockHash(block) {
    try {
      this.logger.debug(`[${this.constructor.name}] checkBlockHash(${block})`);
      const dbBlockHash = await this.blockHashFromDB(block);
      const peerBlockHash = await this.blockHashFromPeer(block);
      if (typeof dbBlockHash !== 'string' || typeof peerBlockHash !== 'string') {
        return false;
      }

      return dbBlockHash === peerBlockHash;
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] checkBlockHash(${block}) error ${error}`);
      return false;
    }
  }

  async insertBlock(blockData) {
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
  }

  async insertUnparsedTransaction() {
    // need override
    return Promise.resolve();
  }

  async oneCycle() {
    // need override
    return Promise.resolve();
  }

  async pendingTransactionFromPeer() {
    // need override
    return Promise.resolve();
  }

  async rollbackBlock() {
    // TODO
    this.logger.debug('rollbackBlock()');
    return Promise.resolve();
  }

  // eslint-disable-next-line no-unused-vars
  async syncBlock(block) {
    // need override
    return Promise.resolve();
  }

  async syncAvgFee() {
    // need override
    return Promise.resolve();
  }

  async updateBalance() {
    // need override
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

  async updateFee(avgFee) {
    this.logger.debug(`[${this.constructor.name}] updateFee(${avgFee})`);
    const insertResult = await this.blockchainModel.update(
      { avg_fee: avgFee },
      { where: { blockchain_id: this.bcid } },
    );
    return insertResult;
  }

  async updatePendingTransaction() {
    // need override
    return Promise.resolve();
  }
}

module.exports = CrawlerManagerBase;
