const Bot = require('./Bot');
const Utils = require('./Utils');
const dvalue = require('dvalue');

class BtcCrawler extends Bot {
  constructor() {
    super();
    this.name = 'BtcCrawler';
  }

  init({
    config, database, logger, i18n,
  }) {
    return super.init({
      config, database, logger, i18n,
    }).then(() => {
      this.blockchainModel = this.database.db.Blockchain;
      this.blockScannedModel = this.database.db.BlockScanned;
      this.currencyModel = this.database.db.Currency;
      this.sequelize = this.database.db.sequelize;
      return this;
    });
  }
  
  start() {
    return super.start()
      .then(async() => {
        this.blockchainName = 'Bitcoin';
        this.options = this.config.bitcoin;
        this.dbBlock = 0;
        this.bcid = await this.blockchainId();
        this.blockNumberFromPeer().then(data => this.logger.log(`blockNumberFromPeer: ${data}`))
      })
      .catch(this.logger.trace);
  }

  ready() {
    return super.ready()
      .then(() => this);
  }

  async blockchainId() {
    const result = await this.blockchainModel.findOne({
      where: { name: this.blockchainName },
    });
    return result.Blockchain_id;
  }

  async blockNumberFromDB() {
    try {
      const result = await this.blockchainModel.findOne({
        where: { blockchainId: this.bcid },
      });
      this.dbBlock = result.block;
      return result.block;
    } catch (error) {
      this.logger.log(error);
      this.dbBlock = 0;
      return 0;
    }
  }

  blockNumberFromPeer() {
    const type = 'getblockcount';
    const options = dvalue.clone(this.options);
    options.data = this.constructor.cmd({ type });
    return Utils.BTCRPC(options)
      .then((data) => {
        if (data instanceof Object) {
          return Promise.resolve(data.result);
        }
        this.logger.log(`\x1b[1m\x1b[90mbtc block number not found\x1b[0m\x1b[21m`);
        return Promise.reject();
      })
  }

  async blockHashFromDB(block) {
    const result = await this.blockScannedModel.findOne({
      where: { blockchainId: this.bcid, block },
    });
    return result.block_hash;
  }

  blockhashFromPeer(block) {
    const type = 'getblockhash';
    const options = dvalue.clone(this.options);
    options.data = this.constructor.cmd({ type, block });
    return Utils.BTCRPC(options)
      .then((data) => {
        if (data.result instanceof Object) {
          return Promise.resolve(data.result);
        }
        this.logger.log(`\x1b[1m\x1b[90mbtc block hash not found\x1b[0m\x1b[21m`);
        return Promise.reject();
      })
  }

  async checkBlockNumber() {
    const dbBlockNumber = await this.blockNumberFromDB();
    const currentBlockNumber = this.blockNumberFromPeer();
    if (typeof dbBlockNumber !== 'number' || typeof currentBlockNumber !== 'number') {
      return Promise.reject();
    }
    return dbBlockNumber <= currentBlockNumber;
  }

  async checkBlockHash(blockNumber) {
    const dbBlockHash = await this.blockHashFromDB(blockNumber);
    const peerBlockHash = await this.blockHashFromPeer(blockNumber);
    if (typeof dbBlockNumber !== 'string' || typeof currentBlockNumber !== 'string') {
      return Promise.reject();
    }

    return dbBlockHash === peerBlockHash;
  }

  async rollbackBlock() {
    return Promise.resolve();
  };

  async syncNextBlock() {

  }

  static cmd({
    type, block,
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
    }
    return result;
  }

}

module.exports = BtcCrawler;