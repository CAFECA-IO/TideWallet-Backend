const { v4: uuidv4 } = require('uuid');
const BigNumber = require('bignumber.js');
const dvalue = require('dvalue');
const ParserBase = require('./ParserBase');
const Utils = require('./Utils');
const HDWallet = require('./HDWallet');

class BtcParserBase extends ParserBase {
  constructor(blockchainId, config, database, logger) {
    super(blockchainId, config, database, logger);

    this.utxoModel = this.database.db.UTXO;
    this.receiptModel = this.database.db.Receipt;
    this.tokenTransactionModel = this.database.db.TokenTransaction;
    this.addressTokenTransactionModel = this.database.db.AddressTokenTransaction;
    this.options = {};
    this.syncInterval = config.syncInterval.pending ? config.syncInterval.pending : 15000;
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
            await BtcParserBase.parseTx.call(this, transaction, this.currencyInfo, tx.timestamp);
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

  static async parseBTCTxAmounts(tx) {
    let from = new BigNumber(0);
    let to = new BigNumber(0);
    let source_addresses = [];
    let destination_addresses = [];
    let note = '';

    for (const inputData of tx.vin) {
      // if coinbase, continue
      if (inputData.txid) {
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

  static async parseTx(tx, currencyInfo, timestamp) {
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
    } = await BtcParserBase.parseBTCTxAmounts.call(this, tx);

    await this.sequelize.transaction(async (transaction) => {
      const transaction_id = uuidv4();

      // 1. insert tx
      const findTransaction = await this.transactionModel.findOrCreate({
        where: {
          currency_id: currencyInfo.currency_id,
          txid: tx.txid,
        },
        defaults: {
          transaction_id,
          currency_id: currencyInfo.currency_id,
          txid: tx.txid,
          timestamp: timestamp || null,
          source_addresses,
          destination_addresses,
          amount: Utils.multipliedByDecimal(to, currencyInfo.decimals),
          fee: Utils.multipliedByDecimal(fee, currencyInfo.decimals),
          note,
          block: tx.height ? tx.height : null,
          result: tx.confirmations >= 6 ? true : null,
        },
        transaction,
      });

      // check transaction exist
      if (findTransaction && findTransaction.length === 2 && findTransaction[1] === false) {
        // Blockchain.js PublishTransaction -> save tx before token on block, update it when parse
        if (!findTransaction[0].block) {
          await this.transactionModel.update({
            timestamp: findTransaction[0].timestamp,
            block: findTransaction[0].block,
          },
          {
            where: {
              transaction_id: findTransaction[0].transaction_id,
            },
            transaction,
          });
        }
      }

      for (const outputData of tx.vout) {
        if (outputData.scriptPubKey && outputData.scriptPubKey.addresses) {
          const [address] = outputData.scriptPubKey.addresses;
          const findAccountAddress = await this.accountAddressModel.findOne({
            where: {
              address,
            },
          });

          if (findAccountAddress) {
            const amount = Utils.multipliedByDecimal(outputData.value, currencyInfo.decimals);
            // 2. insert utxo
            await this.utxoModel.findOrCreate({
              where: {
                txid: tx.txid,
                vout: outputData.n,
              },
              defaults: {
                utxo_id: uuidv4(),
                currency_id: currencyInfo.currency_id,
                accountAddress_id: findAccountAddress.accountAddress_id,
                transaction_id,
                txid: tx.txid,
                vout: outputData.n,
                type: outputData.scriptPubKey.type,
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
        // if coinbase, continue
        if (!inputData.coinbase) {
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
      }

      // 4. check from address is regist address
      for (const sourceAddress of JSON.parse(source_addresses)) {
        const accountAddressFrom = await this.accountAddressModel.findOne({
          where: { address: sourceAddress },
          include: [
            {
              model: this.accountModel,
              attributes: ['blockchain_id'],
              where: { blockchain_id: this.bcid },
            },
          ],
          transaction,
        });
        if (accountAddressFrom) {
          // 5. add mapping table
          await this.addressTransactionModel.findOrCreate({
            where: {
              currency_id: currencyInfo.currency_id,
              accountAddress_id: accountAddressFrom.accountAddress_id,
              transaction_id,
              direction: 0,
            },
            defaults: {
              addressTransaction_id: uuidv4(),
              currency_id: currencyInfo.currency_id,
              accountAddress_id: accountAddressFrom.accountAddress_id,
              transaction_id,
              direction: 0,
            },
            transaction,
          });
        }
      }
      // 6. check to address is regist address
      for (const destinationAddress of JSON.parse(destination_addresses)) {
        const accountAddressFrom = await this.accountAddressModel.findOne({
          where: { address: destinationAddress },
          include: [
            {
              model: this.accountModel,
              attributes: ['account_id', 'blockchain_id', 'extend_public_key'],
              where: { blockchain_id: this.bcid },
              include: [
                {
                  model: this.blockchainModel,
                  attributes: ['coin_type'],
                },
              ],
            },
          ],
          transaction,
        });
        if (accountAddressFrom) {
          // 7. add mapping table
          await this.addressTransactionModel.findOrCreate({
            where: {
              currency_id: currencyInfo.currency_id,
              accountAddress_id: accountAddressFrom.accountAddress_id,
              transaction_id,
              direction: 1,
            },
            defaults: {
              addressTransaction_id: uuidv4(),
              currency_id: currencyInfo.currency_id,
              accountAddress_id: accountAddressFrom.accountAddress_id,
              transaction_id,
              direction: 1,
            },
            transaction,
          });

          // 8. if vout has account change address, update number_of_internal_key += 1
          if (accountAddressFrom.chain_index === 1) {
            const accountCurrency = await this.accountCurrencyModel.increment(
              { number_of_internal_key: 1 },
              {
                where: {
                  account_id: accountAddressFrom.Account.account_id,
                  currency_id: currencyInfo.currency_id,
                },
                transaction,
              },
            );

            if (accountCurrency && accountCurrency.length > 0 && accountCurrency[0] && accountCurrency[0][0] && accountCurrency[0][0][0]) {
              const hdWallet = new HDWallet({ extendPublicKey: accountAddressFrom.Account.extend_public_key });
              const coinType = accountAddressFrom.Account.Blockchain.coin_type;
              const wallet = hdWallet.getWalletInfo({
                change: 1,
                index: accountCurrency[0][0][0].number_of_internal_key,
                coinType,
                blockchainID: accountAddressFrom.Account.blockchain_id,
              });

              await this.accountAddressModel.create({
                accountAddress_id: uuidv4(),
                account_id: accountAddressFrom.Account.account_id,
                chain_index: 1,
                key_index: accountCurrency[0][0][0].number_of_internal_key,
                public_key: wallet.publicKey,
                address: wallet.address,
              });
            }
          }
        }
      }
    });
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
      const pendingTxids = await this.getPendingTransactionFromDB();

      // 3. create transaction which is not in step 1 array
      const newTxids = pendingTxids.filter((pendingTxid) => transactions.every((transaction) => pendingTxid !== transaction.txid));
      for (const txid of newTxids) {
        try {
          const tx = await this.getTransactionByTxidFromPeer(txid);
          await BtcParserBase.parseTx.call(this, tx, this.currencyInfo, tx.time);
        } catch (error) {
          this.logger.debug(`[${this.constructor.name}] parsePendingTransaction create transaction(${txid}) error: ${error}`);
        }
      }

      // 4. update result to false which is not in step 2 array
      const missingTxs = transactions.filter((transaction) => pendingTxids.every((pendingTxid) => pendingTxid !== transaction.txid));
      for (const tx of missingTxs) {
        try {
          const peerTx = await this.getTransactionByTxidFromPeer(tx.txid);
          if (peerTx.blockhash) {
            const blockData = await this.blockDataFromDB(peerTx.blockhash);
            tx.height = blockData.block;
          }
          await BtcParserBase.parseTx.call(this, peerTx, this.currencyInfo, peerTx.time);
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
