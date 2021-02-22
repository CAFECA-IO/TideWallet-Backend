const { v4: uuidv4 } = require('uuid');
const BigNumber = require('bignumber.js');

const ParserBase = require('./ParserBase');

class EthRopstenParser extends ParserBase {
  constructor(config, database, logger) {
    super('8000025B', database, logger);

    this.receiptModel = this.database.db.Receipt;
    this.tokenTransactionModel = this.database.db.TokenTransaction;
    this.addressTokenTransactionModel = this.database.db.AddressTokenTransaction;
    this.syncInterval = config.syncInterval.ethereum ? config.syncInterval.ethereum : 15000;
  }

  async init() {
    await super.init();
    this.isParsing = false;
    setInterval(() => {
      this.doParse();
    }, this.syncInterval);

    this.doParse();
    return this;
  }

  async doParse() {
    if (this.isParsing) {
      this.logger.log(`[${this.constructor.name}] doParse is parsing`);
      return;
    }
    this.isParsing = true;
    // step:
    // 1. load unparsed transactions per block from UnparsedTransaction
    // 2. set queue
    // 3. assign parser
    // 4. remove parsed transaction from UnparsedTransaction table

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        // 1. load unparsed transactions per block from UnparsedTransaction
        const txs = await this.getUnparsedTxs();
        if (!txs || txs.length < 1) break;

        // 2. set queue
        // TODO job queue

        // 3. assign parser
        // TODO get job from queue
        // TODO multiple thread
        for (const tx of txs) {
          const transaction = JSON.parse(tx.transaction);
          const receipt = JSON.parse(tx.receipt);
          await this.parseTx(transaction, receipt, tx.timestamp);
        }

        // 4. remove parsed transaction from UnparsedTransaction table
        for (const tx of txs) {
          await this.removeParsedTx(tx);
        }
      }
      this.isParsing = false;
    } catch (error) {
      this.logger.log(`[${this.constructor.name}] doParse error`);
      this.logger.log(error);
      this.isParsing = false;
      return Promise.resolve();
    }
  }

  async parseTx(tx, receipt, timestamp) {
    // step:
    // 1. insert tx
    // 2. insert recript
    // 3. check from address is contract
    // 3-1. if is contract check is in currency table
    // 3-1-1 if no in db, create currency
    // 4. check is regist address
    // 5. add mapping table
    // 6. check to address is contract
    // 6-1. if is contract check is in currency table
    // 6-1-1 if no in db, create currency
    // 7. check is regist address
    // 8. add mapping table
    this.logger.log(`[${this.constructor.name}] parseTx(${tx.hash})`);
    try {
      const bnGasPrice = new BigNumber(tx.gasPrice, 16);
      const bnGasUsed = new BigNumber(receipt.gasUsed, 16);
      const fee = bnGasPrice.multipliedBy(bnGasUsed).toFixed();
      const insertTx = await this.transactionModel.findOrCreate({
        where: {
          currency_id: this.currencyInfo.currency_id,
          txid: tx.hash,
        },
        defaults: {
          transaction_id: uuidv4(),
          currency_id: this.currencyInfo.currency_id,
          txid: tx.hash,
          timestamp,
          source_addresses: tx.from,
          destination_addresses: tx.to ? tx.to : '',
          amount: tx.value,
          fee,
          note: tx.input,
          block: parseInt(tx.blockNumber, 16),
          nonce: parseInt(tx.nonce, 16),
          gas_price: tx.gasPrice,
          gas_used: parseInt(receipt.gasUsed, 16),
          result: receipt.status === '0x1',
        },
      });

      const insertReceipt = await this.receiptModel.findOrCreate({
        where: {
          transaction_id: insertTx[0].transaction_id,
          currency_id: this.currencyInfo.currency_id,
        },
        defaults: {
          receipt_id: uuidv4(),
          transaction_id: insertTx[0].transaction_id,
          currency_id: this.currencyInfo.currency_id,
          contract_address: receipt.contractAddress,
          cumulative_gas_used: parseInt(receipt.cumulativeGasUsed, 16),
          gas_used: parseInt(receipt.gasUsed, 16),
          logs: JSON.stringify(receipt.logs),
          logsBloom: receipt.logsBloom,
          status: parseInt(receipt.status, 16),
        },
      });

      const { from, to } = tx;
      // 3. check from address is contract
      // TODO

      // 3-1. if is contract check is in currency table
      // TODO

      // 3-1-1 if no in db, create currency
      // TODO

      // 4. check is regist address
      const accountAddressFrom = await this.checkRegistAddress(from);
      if (accountAddressFrom) {
        console.log('is success from');
        // 5. add mapping table
        await this.setAddressTransaction(
          accountAddressFrom.accountAddress_id,
          insertTx[0].transaction_id,
          0,
        );
      }

      // 6. check to address is contract
      // TODO

      // 6-1. if is contract check is in currency table
      // TODO

      // 6-1-1 if no in db, create currency
      // TODO

      // 6-2 if is token, parse transaction

      // 7. check is regist address
      const accountAddressTo = await this.checkRegistAddress(to);
      if (accountAddressTo) {
        console.log('is success to');
        // 8. add mapping table
        await this.setAddressTransaction(
          accountAddressTo.accountAddress_id,
          insertTx[0].transaction_id,
          1,
        );
      }
      return true;
    } catch (error) {
      this.logger.log(`[${this.constructor.name}] parseTx(${tx.hash}) error`);
      this.logger.log(error);
      return Promise.reject(error);
    }
  }
}

module.exports = EthRopstenParser;
