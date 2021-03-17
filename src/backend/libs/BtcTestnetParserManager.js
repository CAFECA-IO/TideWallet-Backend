const BtcParserManagerBase = require('./BtcParserManagerBase');
const BtcTestnetParser = require('./BtcTestnetParser');

class BtcTestnetParserManager extends BtcParserManagerBase {
  constructor(config, database, logger) {
    super('80000001', config, database, logger);

    this.options = config.blockchain.bitcoin_testnet;
  }

  async init() {
    await super.init();

    // add parser
    for (let i = 0; i < this.maxParsers; i++) {
      const parser = new BtcTestnetParser(this.config, this.database, this.logger);
      await parser.init();
      this.parsers.push(parser);
    }
  }
}

module.exports = BtcTestnetParserManager;
