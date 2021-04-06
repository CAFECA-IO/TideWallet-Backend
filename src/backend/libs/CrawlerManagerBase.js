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
    this.transactionModel = this.database.db.Transaction;
    this.feeSyncInterval = 3600000;
    this.pendingTxSyncInterval = 15000;
  }

  async init() {
    this.isSyncing = false;
    this.blockInfo = await this.getBlockInfo();
    this.currencyInfo = await this.getCurrencyInfo();
    if (this.blockInfo.start_block > this.blockInfo.block) {
      await this.updateBlockHeight(this.blockInfo.start_block);
    }
    setInterval(() => {
      this.syncAvgFee();
    }, this.feeSyncInterval);
    this.syncAvgFee();

    setInterval(async () => {
      await this.updatePendingTransaction();
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

  async getCurrencyInfo() {
    this.logger.debug(`[${this.constructor.name}] getCurrencyInfo`);
    try {
      const result = await this.currencyModel.findOne({
        where: { blockchain_id: this.bcid, type: 1 },
        attributes: ['currency_id', 'decimals'],
      });
      return result;
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] currencyModel error ${error}`);
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
      return Promise.reject(error);
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

  async getTransactionsResultNull() {
    this.logger.debug(`[${this.constructor.name}] getTransactionsResultNull`);
    try {
      const pendingTxs = await this.transactionModel.findAll({
        where: { currency_id: this.currencyInfo.currency_id, result: null },
      });
      return pendingTxs;
    } catch (error) {
      this.logger.debug(`[${this.constructor.name}] getTransactionsResultNull error: ${error}`);
      return [];
    }
  }

  // eslint-disable-next-line no-unused-vars
  async insertBlock(blockData) {
    // need override
    return Promise.resolve();
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
