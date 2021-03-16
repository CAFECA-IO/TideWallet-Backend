const EthParserManagerBase = require('./EthParserManagerBase');
const EthParser = require('./EthParser');

class EthParserManager extends EthParserManagerBase {
  constructor(config, database, logger) {
    super('8000003C', config, database, logger);

    this.options = config.blockchain.ethereum_mainnet;
  }

  async init() {
    await super.init();

    // add parser
    for (let i = 0; i < this.maxParsers; i++) {
      const parser = new EthParser(this.config, this.database, this.logger);
      await parser.init();
      this.parsers.push(parser);
    }
  }
}

module.exports = EthParserManager;
