const EthParserBase = require('./EthParserBase');

class EthRopstenParser extends EthParserBase {
  constructor(config, database, logger) {
    super('8000025B', config, database, logger);

    this.receiptModel = this.database.db.Receipt;
    this.tokenTransactionModel = this.database.db.TokenTransaction;
    this.addressTokenTransactionModel = this.database.db.AddressTokenTransaction;
    this.options = config.blockchain.ethereum_ropsten;
    this.syncInterval = config.syncInterval.ethereum ? config.syncInterval.ethereum : 15000;
  }
}

module.exports = EthRopstenParser;
