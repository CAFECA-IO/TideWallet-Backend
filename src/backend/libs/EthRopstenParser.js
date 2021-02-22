const { v4: uuidv4 } = require('uuid');
const BigNumber = require('bignumber.js');
const dvalue = require('dvalue');
const Web3 = require('web3');

const ParserBase = require('./ParserBase');
const Utils = require('./Utils');
const ethABI = require('./abi/ethABI');

class EthRopstenParser extends ParserBase {
  constructor(config, database, logger) {
    super('80000603', database, logger);

    this.receiptModel = this.database.db.Receipt;
    this.tokenTransactionModel = this.database.db.TokenTransaction;
    this.addressTokenTransactionModel = this.database.db.AddressTokenTransaction;
    this.options = config.ethereum.ropsten;
    this.syncInterval = config.syncInterval.ethereum ? config.syncInterval.ethereum : 15000;
  }

  async init() {
    await super.init();
    this.isParsing = false;
    this.web3 = new Web3();
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
      // while (true) {
      // 1. load unparsed transactions per block from UnparsedTransaction
      const txs = await this.getUnparsedTxs();
      // if (!txs || txs.length < 1) break;

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
      //   for (const tx of txs) {
      //     await this.removeParsedTx(tx);
      //   }
      // }
      this.isParsing = false;
    } catch (error) {
      this.logger.log(`[${this.constructor.name}] doParse error`);
      this.logger.log(error);
      this.isParsing = false;
      return Promise.resolve();
    }
  }

  async findOrCreateCurrency(contractAddress) {
    try {
      let currencyInDb = await this.currencyModel.findOne({
        where: { contract: contractAddress },
      });
      if (!currencyInDb) {
        // const name = await this.getTokenNameFromPeer(contractAddress);
        // const symbol = await this.getTokenSymbolFromPeer(contractAddress);
        // const decimals = await this.getTokenDecimalFromPeer(contractAddress);
        // const total_supply = await this.getTokenTotalSupplyFromPeer(contractAddress);
        const tokenInfoFromPeer = await Promise.all([
          this.getTokenNameFromPeer(contractAddress),
          this.getTokenSymbolFromPeer(contractAddress),
          this.getTokenDecimalFromPeer(contractAddress),
          this.getTokenTotalSupplyFromPeer(contractAddress),
        ]).catch((error) => Promise.reject(error));

        currencyInDb = await this.currencyModel.create({
          currency_id: uuidv4(),
          blockchain_id: this.bcid,
          name: tokenInfoFromPeer[0],
          symbol: tokenInfoFromPeer[1],
          type: 2,
          publish: false,
          decimals: tokenInfoFromPeer[2],
          total_supply: tokenInfoFromPeer[3],
          contract: contractAddress,
        });
        return currencyInDb;
      }
    } catch (error) {
      this.logger.log(`[${this.constructor.name}] findOrCreateCurrency error`);
      this.logger.log(error);
      return Promise.reject(error);
    }
  }

  async getTokenNameFromPeer(address) {
    try {
      const type = 'callContract';
      const options = dvalue.clone(this.options);
      const command = '0x06fdde03'; // erc20 get name
      options.data = this.constructor.cmd({ type, address, command });
      const checkId = options.data.id;
      const data = await Utils.ETHRPC(options);
      if (data instanceof Object) {
        if (data.id !== checkId) {
          this.logger.log(`[${this.constructor.name}] getTokenNameFromPeer fail`);
          return null;
        }
        const nameEncode = data.result;
        const name = this.web3.eth.abi.decodeParameter('string', nameEncode);
        return Promise.resolve(name);
      }
      this.logger.log(`[${this.constructor.name}] getTokenNameFromPeer fail`);
      return Promise.reject();
    } catch (error) {
      this.logger.log(`[${this.constructor.name}] getTokenNameFromPeer error`);
      this.logger.log(error);
      return null;
    }
  }

  async getTokenSymbolFromPeer(address) {
    try {
      const type = 'callContract';
      const options = dvalue.clone(this.options);
      const command = '0x95d89b41'; // erc20 get synbol
      options.data = this.constructor.cmd({ type, address, command });
      const checkId = options.data.id;
      const data = await Utils.ETHRPC(options);
      if (data instanceof Object) {
        if (data.id !== checkId) {
          this.logger.log(`[${this.constructor.name}] getTokenSymbolFromPeer fail`);
          return null;
        }
        const symbolEncode = data.result;
        const symbol = this.web3.eth.abi.decodeParameter('string', symbolEncode);
        return Promise.resolve(symbol);
      }
      this.logger.log(`[${this.constructor.name}] getTokenSymbolFromPeer fail`);
      return Promise.reject();
    } catch (error) {
      this.logger.log(`[${this.constructor.name}] getTokenSymbolFromPeer error`);
      this.logger.log(error);
      return null;
    }
  }

  async getTokenDecimalFromPeer(address) {
    try {
      const type = 'callContract';
      const options = dvalue.clone(this.options);
      const command = '0x313ce567'; // erc20 get decimals
      options.data = this.constructor.cmd({ type, address, command });
      const checkId = options.data.id;
      const data = await Utils.ETHRPC(options);
      if (data instanceof Object) {
        if (data.id !== checkId) {
          this.logger.log(`[${this.constructor.name}] getTokenDecimalFromPeer fail`);
          return null;
        }
        const decimals = data.result;
        return Promise.resolve(parseInt(decimals));
      }
      this.logger.log(`[${this.constructor.name}] getTokenDecimalFromPeer fail`);
      return Promise.reject();
    } catch (error) {
      this.logger.log(`[${this.constructor.name}] getTokenDecimalFromPeer error`);
      this.logger.log(error);
      return null;
    }
  }

  async getTokenTotalSupplyFromPeer(address) {
    try {
      const type = 'callContract';
      const options = dvalue.clone(this.options);
      const command = '0x18160ddd'; // erc20 get total supply
      options.data = this.constructor.cmd({ type, address, command });
      const checkId = options.data.id;
      const data = await Utils.ETHRPC(options);
      if (data instanceof Object) {
        if (data.id !== checkId) {
          this.logger.log(`[${this.constructor.name}] getTokenTotalSupplyFromPeer fail`);
          return null;
        }
        if (data.result) {
          const bnTotalSupply = new BigNumber(data.result, 16);
          return Promise.resolve(bnTotalSupply.toFixed());
        }
      }
      this.logger.log(`[${this.constructor.name}] getTokenTotalSupplyFromPeer fail`);
      return null;
    } catch (error) {
      this.logger.log(`[${this.constructor.name}] getTokenTotalSupplyFromPeer error`);
      this.logger.log(error);
      return null;
    }
  }

  async parseReceiptTopic(receipt, transaction_id) {
    this.logger.log(`[${this.constructor.name}] parseReceiptTopic`);
    // step:
    // 1. parse log
    // 2. parse each logs topics
    // 3. check topic has 'Transfer'
    // 4. if yes, find or create currency by address
    // 5. create TokenTransaction
    // 6. create mapping table

    try {
      const { logs } = receipt;
      console.log('logs', logs);

      for (const log of logs) {
        const { address, topics } = log;
        const abi = ethABI[topics[0]];

        // 3. check topic has 'Transfer'
        if (abi && abi.name === 'Transfer' && abi.type === 'event') {
          // 4. if yes, find or create currency by address
          const currency = await this.findOrCreateCurrency(address);
        }
      }
    } catch (error) {
      this.logger.log(`[${this.constructor.name}] parseReceiptTopic error`);
      this.logger.log(error);
      Promise.reject(error);
    }
  }

  async parseTx(tx, receipt, timestamp) {
    // step:
    // 1. insert tx
    // 2. insert recript
    // 3. parse receipt to check is token transfer
    // 3-1. if yes insert token transaction
    // 4. check from address is regist address
    // 5. add mapping table
    // 6. check to address is regist address
    // 7. add mapping table

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
      // 3. parse receipt to check is token transfer
      await this.parseReceiptTopic(receipt, insertTx[0].transaction_id);

      // 3-1. if yes insert token transaction
      // TODO

      // 4. check from address is regist address
      const accountAddressFrom = await this.checkRegistAddress(from);
      if (accountAddressFrom) {
        // 5. add mapping table
        await this.setAddressTransaction(
          accountAddressFrom.accountAddress_id,
          insertTx[0].transaction_id,
          0,
        );
      }

      // 6. check to address is regist address
      const accountAddressTo = await this.checkRegistAddress(to);
      if (accountAddressTo) {
        // 7. add mapping table
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

  static cmd({
    type, address, command,
  }) {
    let result;
    switch (type) {
      case 'callContract':
        result = {
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [{
            to: address,
            data: command,
          }, 'latest'],
          id: dvalue.randomID(),
        };
        break;
      default:
        result = {};
    }
    return result;
  }
}

module.exports = EthRopstenParser;
