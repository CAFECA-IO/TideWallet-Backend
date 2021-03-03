const { v4: uuidv4 } = require('uuid');
const BigNumber = require('bignumber.js');
const dvalue = require('dvalue');
const ecrequest = require('ecrequest');
const ParserBase = require('./ParserBase');
const Utils = require('./Utils');

class BtcParserBase extends ParserBase {
  constructor(blockchainId, config, database, logger) {
    super(blockchainId, config, database, logger);

    this.utxoModel = this.database.db.UTXO;
    this.receiptModel = this.database.db.Receipt;
    this.tokenTransactionModel = this.database.db.TokenTransaction;
    this.addressTokenTransactionModel = this.database.db.AddressTokenTransaction;
    this.options = {};
    this.syncInterval = 900000;
    this.decimal = 8;
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
    // 4. update failed unparsed retry
    // 5. remove parsed transaction from UnparsedTransaction table

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
            await this.parseTx(transaction, tx.timestamp);
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

  async blockHeightByBlockHashFromPeer(block) {
    this.logger.debug(`[${this.constructor.name}] blockHeightByBlockHashFromPeer(${block})`);
    const type = 'getBlockHeight';
    const options = dvalue.clone(this.options);
    options.data = this.constructor.cmd({ type, block });
    const checkId = options.data.id;
    const data = await Utils.BTCRPC(options);
    if (data instanceof Object) {
      if (data.id !== checkId) {
        this.logger.error(`[${this.constructor.name}] blockHeightByBlockHashFromPeer not found`);
        return Promise.reject();
      }
      if (data.result) {
        const height = data.result.height[2] || '0';
        return Promise.resolve(height);
      }
    }
    this.logger.error(`[${this.constructor.name}] blockHeightByBlockHashFromPeer not found`);
    return Promise.reject(data.error);
  }

  async getTransactionByTxidFromPeer(txid) {
    this.logger.debug(`[${this.constructor.name}] getTransactionByTxidFromPeer(${txid})`);
    const type = 'getTransaction';
    const options = dvalue.clone(this.options);
    options.data = this.constructor.cmd({ type, txid });
    const checkId = options.data.id;
    const data = await Utils.BTCRPC(options);
    if (data instanceof Object) {
      if (data.id !== checkId) {
        this.logger.error(`[${this.constructor.name}] getTransactionByTxidFromPeer not found`);
        return Promise.reject();
      }
      if (data.result) {
        return Promise.resolve(data.result);
      }
    }
    this.logger.error(`[${this.constructor.name}] getTransactionByTxidFromPeer not found`);
    return Promise.reject(data.error);
  }

  async parseBTCTxAmounts(tx) {
    let from = new BigNumber(0);
    let to = new BigNumber(0);
    let source_addresses = [];
    let destination_addresses = [];
    let note = '';

    for (const inputData of tx.vin) {
      const findUXTO = await this.utxoModel.findOne({ where: { txid: inputData.txid } });
      if (findUXTO) {
        from = from.plus(new BigNumber(findUXTO.amount).dividedBy(new BigNumber(10 ** this.decimal)));
      }

      // TODO: change use promise all
      const txInfo = await this.getTransactionByTxidFromPeer(inputData.txid);
      if (txInfo && txInfo.vout && txInfo.vout.length > inputData.vout) {
        if (txInfo.vout[inputData.vout].scriptPubKey && txInfo.vout[inputData.vout].scriptPubKey.addresses) {
          source_addresses = source_addresses.concat(txInfo.vout[inputData.vout].scriptPubKey.addresses);
        } else if (txInfo.vout[inputData.vout].scriptPubKey && txInfo.vout[inputData.vout].scriptPubKey.type === 'pubkey') {
          // TODO: need pubkey => P2PK address
          source_addresses.push(txInfo.vout[inputData.vout].scriptPubKey.hex);
        }
      }
    }

    for (const outputData of tx.vout) {
      to = to.plus(new BigNumber(outputData.value));
      if (outputData.scriptPubKey && outputData.scriptPubKey.addresses) {
        destination_addresses = destination_addresses.concat(outputData.scriptPubKey.addresses);
      }
      if (outputData.scriptPubKey && outputData.scriptPubKey.asm && outputData.scriptPubKey.asm.slice(0, 9) === 'OP_RETURN1') {
        note = outputData.scriptPubKey.hex || '';
      } else if (outputData.scriptPubKey && outputData.scriptPubKey.type === 'pubkey') {
        // TODO: need pubkey => P2PK address
        destination_addresses.push(outputData.scriptPubKey.hex);
      }
    }

    return {
      from, to, fee: from.plus(to), source_addresses: JSON.stringify(source_addresses), destination_addresses: JSON.stringify(destination_addresses), note,
    };
  }

  formatTxType(type) {
    switch (type) {
      case 'pubkeyhash':
        return 0;
      case 'witness_v0_keyhash':
        return 1;
      case 'witness_v0_scripthash':
        return 2;
      default:
        return -1;
    }
  }

  async parseTx(tx, timestamp) {
    // step:
    // 1. insert tx
    // 2. insert utxo
    // 3. update used utxo(to_tx), if vin used
    // 4. check from address is regist address
    // 5. add mapping table
    // 6. check to address is regist address
    // 7. add mapping table
    this.logger.debug(`[${this.constructor.name}] parseTx(${tx.hash})`);
    const {
      fee, to, source_addresses, destination_addresses, note,
    } = await this.parseBTCTxAmounts(tx);

    try {
      await this.sequelize.transaction(async (transaction) => {
        const transaction_id = uuidv4();

        // 1. insert tx
        await this.transactionModel.findOrCreate({
          where: {
            currency_id: this.currencyInfo.currency_id,
            txid: tx.txid,
          },
          defaults: {
            transaction_id,
            currency_id: this.currencyInfo.currency_id,
            txid: tx.txid,
            timestamp,
            source_addresses,
            destination_addresses,
            amount: Utils.multipliedByDecimal(to, this.currencyInfo.decimals),
            fee: Utils.multipliedByDecimal(fee, this.currencyInfo.decimals),
            note,
            block: tx.height,
            result: true,
          },
          transaction,
        });

        for (const outputData of tx.vout) {
          if (outputData.scriptPubKey && outputData.scriptPubKey.addresses) {
            const [address] = outputData.scriptPubKey.addresses;
            const findAccountAddress = await this.accountAddressModel.findOne({
              where: {
                address,
              },
            });

            const type = this.formatTxType(outputData.scriptPubKey.type);
            if (findAccountAddress && type !== -1) {
              const amount = Utils.multipliedByDecimal(outputData.value, this.currencyInfo.decimals);
              // 2. insert utxo
              await this.utxoModel.findOrCreate({
                where: {
                  txid: tx.txid,
                  vout: outputData.n,
                },
                defaults: {
                  utxo_id: uuidv4(),
                  currency_id: this.currencyInfo.currency_id,
                  accountAddress_id: findAccountAddress.accountAddress_id,
                  transaction_id,
                  txid: tx.txid,
                  vout: outputData.n,
                  type,
                  amount,
                  script: outputData.scriptPubKey.hex,
                  locktime: tx.locktime,
                },
                transaction,
              });
            }
          }
        }
        // 3. update used utxo(to_tx), if vin used
        for (const inputData of tx.vin) {
          const findExistUTXO = await this.utxoModel.findOne({
            where: {
              txid: tx.txid,
              vout: inputData.vout,
            },
            transaction,
          });
          if (findExistUTXO) {
            await this.utxoModel.update({
              to_tx: transaction_id,
              on_block_timestamp: tx.timestamp,
            },
            {
              where: {
                txid: tx.txid,
                vout: inputData.vout,
              },
              transaction,
            });
          }
        }

        // 4. check from address is regist address
        for (const sourceAddress of source_addresses) {
          const accountAddressFrom = await this.checkRegistAddress(sourceAddress);
          if (accountAddressFrom) {
            // 5. add mapping table
            await this.setAddressTransaction(
              accountAddressFrom.accountAddress_id,
              transaction_id,
              0,
            );
          }
        }
        // 6. check to address is regist address
        for (const destinationAddress of destination_addresses) {
          const accountAddressFrom = await this.checkRegistAddress(destinationAddress);
          if (accountAddressFrom) {
            // 7. add mapping table
            await this.setAddressTransaction(
              accountAddressFrom.accountAddress_id,
              transaction_id,
              1,
            );
          }
        }
      });
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  async setAddressTokenTransaction(currency_id, accountAddress_id, tokenTransaction_id, direction) {
    this.logger.debug(`[${this.constructor.name}] setAddressTokenTransaction(${currency_id}, ${accountAddress_id}, ${tokenTransaction_id}, ${direction})`);
    try {
      const result = await this.addressTokenTransactionModel.findOrCreate({
        where: {
          currency_id,
          accountAddress_id,
          tokenTransaction_id,
          direction,
        },
        defaults: {
          addressTokenTransaction_id: uuidv4(),
          currency_id,
          accountAddress_id,
          tokenTransaction_id,
          direction,
        },
      });
      return result;
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] setAddressTokenTransaction(${currency_id}, ${accountAddress_id}, ${tokenTransaction_id}, ${direction}) error: ${error}`);
      return Promise.reject(error);
    }
  }

  static cmd({
    type, txid,
  }) {
    let result;
    switch (type) {
      case 'getTransaction':
        result = {
          jsonrpc: '1.0',
          method: 'getrawtransaction',
          params: [txid, true],
          id: dvalue.randomID(),
        };
        break;
      default:
        result = {};
    }
    return result;
  }
}

module.exports = BtcParserBase;
