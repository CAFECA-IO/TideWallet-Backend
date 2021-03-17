const BtcParserManagerBase = require('./BtcParserManagerBase');
const BtcParser = require('./BtcParser');

class BtcParserManager extends BtcParserManagerBase {
  constructor(config, database, logger) {
    super('80000000', config, database, logger);

    this.options = config.blockchain.bitcoin_testnet;
  }

  async init() {
    await super.init();

    // add parser
    for (let i = 0; i < this.maxParsers; i++) {
      const parser = new BtcParser(this.config, this.database, this.logger);
      await parser.init();
      this.parsers.push(parser);
    }
  }
}

module.exports = BtcParserManager;
