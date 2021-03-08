const { v4: uuidv4 } = require('uuid');
const BigNumber = require('bignumber.js');
const dvalue = require('dvalue');
const Web3 = require('web3');
const ecrequest = require('ecrequest');
const ParserBase = require('./ParserBase');
const Utils = require('./Utils');
const ethABI = require('./abi/ethABI');

class EthParserBase extends ParserBase {
  constructor(blockchainId, config, database, logger) {
    super(blockchainId, config, database, logger);

    this.receiptModel = this.database.db.Receipt;
    this.tokenTransactionModel = this.database.db.TokenTransaction;
    this.addressTokenTransactionModel = this.database.db.AddressTokenTransaction;
    this.options = {};
    this.syncInterval = 15000;
  }

  async init() {
    await super.init();
    this.isParsing = false;
    this.web3 = new Web3();
    setInterval(async () => {
      await this.doParse();
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
    // 4. update failed unparsed retry
    // 5. remove parsed transaction from UnparsedTransaction table
    // 6. update balance

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
        const failedList = [];
        for (const tx of txs) {
          try {
            const transaction = JSON.parse(tx.transaction);
            const receipt = JSON.parse(tx.receipt);
            await this.parseTx(transaction, receipt, tx.timestamp);
          } catch (error) {
            failedList.push(tx);
          }
        }

        // 4. update failed unparsed retry
        let successParsedTxs = txs;
        successParsedTxs = successParsedTxs.filter((tx) => failedList.every((failedTx) => tx.unparsedTransaction_id !== failedTx.unparsedTransaction_id));

        for (const failedTx of failedList) {
          await this.updateRetry(failedTx);
        }

        // 5. remove parsed transaction from UnparsedTransaction table
        for (const tx of successParsedTxs) {
          await this.removeParsedTx(tx);
        }
      }

      await this.updateBalance();
      this.isParsing = false;
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] doParse error: ${error}`);
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
        const tokenInfoFromPeer = await Promise.all([
          this.getTokenNameFromPeer(contractAddress),
          this.getTokenSymbolFromPeer(contractAddress),
          this.getTokenDecimalFromPeer(contractAddress),
          this.getTokenTotalSupplyFromPeer(contractAddress),
        ]).catch((error) => Promise.reject(error));
        if (!Array.isArray(tokenInfoFromPeer) || !tokenInfoFromPeer[0] || !tokenInfoFromPeer[1] || !(tokenInfoFromPeer[2] >= 0) || !tokenInfoFromPeer[3]) throw tokenInfoFromPeer;

        let icon = `https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@9ab8d6934b83a4aa8ae5e8711609a70ca0ab1b2b/32/icon/${tokenInfoFromPeer[1].toLocaleLowerCase()}.png`;
        try {
          const checkIcon = await ecrequest.get({
            protocol: 'https:',
            hostname: 'cdn.jsdelivr.net',
            port: '',
            path: `/gh/atomiclabs/cryptocurrency-icons@9ab8d6934b83a4aa8ae5e8711609a70ca0ab1b2b/32/icon/${tokenInfoFromPeer[1].toLocaleLowerCase()}.png`,
            timeout: 1000,
          });
          if (checkIcon.data.toString().indexOf('Couldn\'t find') !== -1) throw Error('Couldn\'t find');
        } catch (e) {
          icon = `${this.config.base.domain}/icon/ERC20.png`;
        }

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
          icon,
        });
      }
      return currencyInDb;
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] findOrCreateCurrency error: ${error}`);
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
          this.logger.error(`[${this.constructor.name}] getTokenNameFromPeer fail`);
          return null;
        }
        if (data.result) {
          const nameEncode = data.result;
          if (nameEncode.length !== 194) return nameEncode;
          const name = this.web3.eth.abi.decodeParameter('string', nameEncode);
          return Promise.resolve(name);
        }
      }
      this.logger.error(`[${this.constructor.name}] getTokenNameFromPeer(${address}) fail, ${JSON.stringify(data.error)}`);
      return null;
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] getTokenNameFromPeer(${address}) error: ${error}`);
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
          this.logger.error(`[${this.constructor.name}] getTokenSymbolFromPeer fail`);
          return null;
        }
        if (data.result) {
          const symbolEncode = data.result;
          if (symbolEncode.length !== 194) return symbolEncode;
          const symbol = this.web3.eth.abi.decodeParameter('string', symbolEncode);
          return Promise.resolve(symbol);
        }
      }
      this.logger.error(`[${this.constructor.name}] getTokenSymbolFromPeer(${address}) fail, ${JSON.stringify(data.error)}`);
      return null;
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] getTokenSymbolFromPeer(${address}) error: ${error}`);
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
          this.logger.error(`[${this.constructor.name}] getTokenDecimalFromPeer fail`);
          return null;
        }
        const decimals = data.result;
        if (data.result) { return Promise.resolve(parseInt(decimals, 16)); }
      }
      this.logger.error(`[${this.constructor.name}] getTokenDecimalFromPeer(${address}) fail, ${JSON.stringify(data.error)}`);
      return null;
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] getTokenDecimalFromPeer(${address}) error: ${error}`);
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
          this.logger.error(`[${this.constructor.name}] getTokenTotalSupplyFromPeer fail`);
          return null;
        }
        if (data.result) {
          const bnTotalSupply = new BigNumber(data.result, 16);
          return Promise.resolve(bnTotalSupply.toFixed());
        }
      }
      this.logger.error(`[${this.constructor.name}] getTokenTotalSupplyFromPeer(${address}) fail, ${JSON.stringify(data.error)}`);
      return null;
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] getTokenTotalSupplyFromPeer(${address}) error: ${error}`);
      return null;
    }
  }

  async parseReceiptTopic(receipt, transaction) {
    this.logger.debug(`[${this.constructor.name}] parseReceiptTopic`);
    // step:
    // 1. parse log
    // 2. parse each logs topics
    // 3. check topic has 'Transfer'
    // 4. if yes, find or create currency by address
    // 5. set TokenTransaction
    // 6. check from address is regist address
    // 7. add mapping table
    // 8. check to address is regist address
    // 9. add mapping table

    try {
      const { logs } = receipt;

      for (const log of logs) {
        const { address, data, topics } = log;
        const abi = ethABI[topics[0]];

        // 3. check topic has 'Transfer'
        if (abi && abi.name === 'Transfer' && abi.type === 'event') {
          // 4. if yes, find or create currency by address
          const currency = await this.findOrCreateCurrency(address);

          // 5. set TokenTransaction
          const bnAmount = new BigNumber(data, 16);
          const from = Utils.parse32BytesAddress(topics[1]);
          const to = Utils.parse32BytesAddress(topics[2]);
          const tokenTransaction = await this.tokenTransactionModel.findOrCreate({
            where: {
              transaction_id: transaction.transaction_id, currency_id: currency.currency_id,
            },
            defaults: {
              tokenTransaction_id: uuidv4(),
              transaction_id: transaction.transaction_id,
              currency_id: currency.currency_id,
              txid: transaction.txid,
              timestamp: transaction.timestamp,
              source_addresses: from,
              destination_addresses: to,
              amount: bnAmount.toFixed(),
              result: receipt.status === '0x1',
            },
          });

          // 6. check from address is regist address
          const accountAddressFrom = await this.checkRegistAddress(from);
          if (accountAddressFrom) {
            // 7. add mapping table
            await this.setAddressTokenTransaction(
              currency.currency_id,
              accountAddressFrom.accountAddress_id,
              tokenTransaction[0].amount,
              tokenTransaction[0].tokenTransaction_id,
              0,
            );
            await this.accountCurrencyModel.findOrCreate({
              where: {
                account_id: accountAddressFrom.account_id,
                currency_id: currency.currency_id,
                number_of_external_key: '0',
                number_of_internal_key: '0',
              },
              defaults: {
                accountCurrency_id: uuidv4(),
                account_id: accountAddressFrom.account_id,
                currency_id: currency.currency_id,
                balance: bnAmount.toFixed(),
                number_of_external_key: '0',
                number_of_internal_key: '0',
              },
            });
          }
          // 8. check to address is regist address
          const accountAddressTo = await this.checkRegistAddress(to);
          if (accountAddressTo) {
            // 9. add mapping table
            await this.setAddressTokenTransaction(
              currency.currency_id,
              accountAddressTo.accountAddress_id,
              tokenTransaction[0].amount,
              tokenTransaction[0].tokenTransaction_id,
              1,
            );

            await this.accountCurrencyModel.findOrCreate({
              where: {
                account_id: accountAddressTo.account_id,
                currency_id: currency.currency_id,
                number_of_external_key: '0',
                number_of_internal_key: '0',
              },
              defaults: {
                accountCurrency_id: uuidv4(),
                account_id: accountAddressTo.account_id,
                currency_id: currency.currency_id,
                balance: bnAmount.toFixed(),
                number_of_external_key: '0',
                number_of_internal_key: '0',
              },
            });
          }
        }
      }
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] parseReceiptTopic error: ${error}`);
      return Promise.resolve(error);
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

    this.logger.debug(`[${this.constructor.name}] parseTx(${tx.hash})`);
    try {
      const bnAmount = new BigNumber(tx.value, 16);
      const bnGasPrice = new BigNumber(tx.gasPrice, 16);
      const bnGasUsed = new BigNumber(receipt.gasUsed, 16);
      const fee = bnGasPrice.multipliedBy(bnGasUsed).toFixed();
      let insertTx = await this.transactionModel.findOne({
        where: {
          currency_id: this.currencyInfo.currency_id,
          txid: tx.hash,
        },
      });
      if (!insertTx) {
        insertTx = await this.transactionModel.create({
          transaction_id: uuidv4(),
          currency_id: this.currencyInfo.currency_id,
          txid: tx.hash,
          timestamp,
          source_addresses: tx.from,
          destination_addresses: tx.to ? tx.to : '',
          amount: bnAmount.toFixed(),
          fee,
          note: tx.input,
          block: parseInt(tx.blockNumber, 16),
          nonce: parseInt(tx.nonce, 16),
          gas_price: bnGasPrice.toFixed(),
          gas_used: bnGasUsed.toFixed(),
          result: receipt.status === '0x1',
        });
      } else {
        const updateResult = await this.transactionModel.update({
          timestamp,
          fee,
          block: parseInt(tx.blockNumber, 16),
          gas_used: bnGasUsed.toFixed(),
          result: receipt.status === '0x1',
        }, {
          where: {
            currency_id: this.currencyInfo.currency_id,
            txid: tx.hash,
          },
          returning: true,
        });

        [, [insertTx]] = updateResult;
      }

      await this.receiptModel.findOrCreate({
        where: {
          transaction_id: insertTx.transaction_id,
          currency_id: this.currencyInfo.currency_id,
        },
        defaults: {
          receipt_id: uuidv4(),
          transaction_id: insertTx.transaction_id,
          currency_id: this.currencyInfo.currency_id,
          contract_address: receipt.contractAddress,
          cumulative_gas_used: parseInt(receipt.cumulativeGasUsed, 16),
          gas_used: bnGasUsed.toFixed(),
          logs: JSON.stringify(receipt.logs),
          logsBloom: receipt.logsBloom,
          status: parseInt(receipt.status, 16),
        },
      });

      const { from, to } = tx;
      // 3. parse receipt to check is token transfer
      await this.parseReceiptTopic(receipt, insertTx);

      // 3-1. if yes insert token transaction
      // TODO

      // 4. check from address is regist address
      const accountAddressFrom = await this.checkRegistAddress(from);
      if (accountAddressFrom) {
        // 5. add mapping table
        await this.setAddressTransaction(
          accountAddressFrom.accountAddress_id,
          insertTx.transaction_id,
          insertTx.amount,
          0,
        );
      }

      // 6. check to address is regist address
      const accountAddressTo = await this.checkRegistAddress(to);
      if (accountAddressTo) {
        // 7. add mapping table
        await this.setAddressTransaction(
          accountAddressTo.accountAddress_id,
          insertTx.transaction_id,
          insertTx.amount,
          1,
        );
      }

      return true;
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] parseTx(${tx.hash}) error: ${error}`);
      return Promise.reject(error);
    }
  }

  async setAddressTokenTransaction(currency_id, accountAddress_id, amount, tokenTransaction_id, direction) {
    this.logger.debug(`[${this.constructor.name}] setAddressTokenTransaction(${currency_id}, ${accountAddress_id}, ${tokenTransaction_id}, ${direction})`);
    try {
      const result = await this.addressTokenTransactionModel.findOrCreate({
        where: {
          currency_id,
          accountAddress_id,
          tokenTransaction_id,
          amount,
          direction,
        },
        defaults: {
          addressTokenTransaction_id: uuidv4(),
          currency_id,
          accountAddress_id,
          tokenTransaction_id,
          amount,
          direction,
        },
      });
      return result;
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] setAddressTokenTransaction(${currency_id}, ${accountAddress_id}, ${tokenTransaction_id}, ${direction}) error: ${error}`);
      return Promise.reject(error);
    }
  }

  async updateBalance() {
    this.logger.debug(`[${this.constructor.name}] updateBalance`);
    // step:
    // 1. update pending transaction
    try {
      await this.parsePendingTransaction();
    } catch (error) {
      this.logger.debug(`[${this.constructor.name}] updateBalance error: ${error}`);
      return Promise.reject(error);
    }
  }

  async parsePendingTransaction() {
    this.logger.debug(`[${this.constructor.name}] parsePendingTransaction`);
    // step:
    // 1. find all transaction where status is null(means pending transaction)
    // 2. get last pending transaction from pendingTransaction table
    // 3. create transaction which is not in step 1 array
    // 4. update result to false which is not in step 2 array
    try {
      // 1. find all transaction where status is null(means pending transaction)
      const transactions = await this.getTransactionsResultNull();

      // 2. get last pending transaction from pendingTransaction table
      const pendingTxs = await this.getPendingTransactionFromDB();

      // 3. create transaction which is not in step 1 array
      const newTxs = pendingTxs.filter((pendingTx) => transactions.every((transaction) => pendingTx.hash !== transaction.txid));
      for (const tx of newTxs) {
        try {
          const bnAmount = new BigNumber(tx.value, 16);
          const bnGasPrice = new BigNumber(tx.gasPrice, 16);
          const bnGas = new BigNumber(tx.gas, 16);
          const fee = bnGasPrice.multipliedBy(bnGas).toFixed();

          let txResult = await this.transactionModel.findOne({
            where: {
              currency_id: this.currencyInfo.currency_id,
              txid: tx.hash,
            },
          });
          if (!txResult) {
            this.logger.debug(`[${this.constructor.name}] parsePendingTransaction create transaction(${tx.hash})`);
            txResult = await this.transactionModel.create({
              transaction_id: uuidv4(),
              currency_id: this.currencyInfo.currency_id,
              txid: tx.hash,
              source_addresses: tx.from,
              destination_addresses: tx.to ? tx.to : '',
              amount: bnAmount.toFixed(),
              note: tx.input,
              block: parseInt(tx.blockNumber, 16),
              nonce: parseInt(tx.nonce, 16),
              fee,
              gas_price: bnGasPrice.toFixed(),
            });
          } else {
            const updateResult = await this.transactionModel.update(
              {
                source_addresses: tx.from,
                destination_addresses: tx.to ? tx.to : '',
                amount: bnAmount.toFixed(),
                note: tx.input,
                block: parseInt(tx.blockNumber, 16),
                nonce: parseInt(tx.nonce, 16),
                gas_price: bnGasPrice.toFixed(),
              }, {
                where: {
                  currency_id: this.currencyInfo.currency_id,
                  txid: tx.hash,
                },
                returning: true,
              },
            );
            [, [txResult]] = updateResult;
          }
        } catch (error) {
          this.logger.debug(`[${this.constructor.name}] parsePendingTransaction create transaction(${tx.hash}) error: ${error}`);
        }
      }

      // 4. update result to false which is not in step 2 array
      const missingTxs = transactions.filter((transaction) => pendingTxs.every((pendingTx) => pendingTx.hash !== transaction.txid));
      for (const tx of missingTxs) {
        try {
          this.logger.debug(`[${this.constructor.name}] parsePendingTransaction update failed transaction(${tx.txid})`);
          await this.transactionModel.update(
            {
              result: false,
            },
            {
              where: {
                currency_id: this.currencyInfo.currency_id,
                txid: tx.txid,
              },
            },
          );
        } catch (error) {
          this.logger.debug(`[${this.constructor.name}] parsePendingTransaction update failed transaction(${tx.hash}) error: ${error}`);
        }
      }
    } catch (error) {
      this.logger.debug(`[${this.constructor.name}] parsePendingTransaction`);
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

module.exports = EthParserBase;
