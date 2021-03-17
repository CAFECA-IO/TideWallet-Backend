const { v4: uuidv4 } = require('uuid');
const BigNumber = require('bignumber.js');
const dvalue = require('dvalue');
const ParserManagerBase = require('./ParserManagerBase');
const Utils = require('./Utils');
const HDWallet = require('./HDWallet');

class BtcParserManagerBase extends ParserManagerBase {
  constructor(blockchainId, config, database, logger) {
    super(blockchainId, config, database, logger);

    this.utxoModel = this.database.db.UTXO;
    this.receiptModel = this.database.db.Receipt;
    this.tokenTransactionModel = this.database.db.TokenTransaction;
    this.addressTokenTransactionModel = this.database.db.AddressTokenTransaction;
    this.options = {};
    this.syncInterval = config.syncInterval.pending ? config.syncInterval.pending : 15000;
    this.decimal = 8;

    this.updateBalanceAccounts = {};
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

  async createJob() {
    this.logger.debug(`[${this.constructor.name}] createJob`);
    // 1. load unparsed transactions per block from UnparsedTransaction
    // 2. check has unparsed transaction
    // 2-1. if no parse update balance
    // 2-2. if yes setJob
    try {
      // 1. load unparsed transactions per block from UnparsedTransaction
      this.block = await this.blockNumberFromDB();
      const txs = await this.getUnparsedTxs();

      // 2. check has unparsed transaction
      if (!txs || txs.length < 1) {
        // 2-1. if no parse update balance
        await this.updateBalance();
        this.isParsing = false;
      } else {
        this.jobDoneList = [];
        this.numberOfJobs = 0;

        for (const tx of txs) {
          await this.setJob(tx);
        }
      }
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] createJob error: ${error}`);
      this.isParsing = false;
      return Promise.resolve(error);
    }
  }

  async doCallback(job) {
    this.isParsing = true;
    // job = { ...UnparsedTransaction, success: bool }
    this.jobDoneList.push(job);
    if (this.jobDoneList.length === this.numberOfJobs) {
      // 3. update failed unparsed retry
      // 4. remove parsed transaction from UnparsedTransaction table
      try {
        const successParsedTxs = this.jobDoneList.filter((tx) => tx.success === true);
        const failedList = this.jobDoneList.filter((tx) => tx.success === false);

        // 3. update failed unparsed retry
        for (const failedTx of failedList) {
          await this.updateRetry(failedTx);
        }

        // 4. remove parsed transaction from UnparsedTransaction table
        for (const tx of successParsedTxs) {
          await this.removeParsedTx(tx);
        }

        await this.createJob();
      } catch (error) {
        this.logger.error(`[${this.constructor.name}] doParse error: ${error}`);
        this.isParsing = false;
        return Promise.resolve();
      }
    }
  }

  async doParse() {
    if (this.isParsing) {
      this.logger.log(`[${this.constructor.name}] doParse is parsing`);
      return;
    }
    this.isParsing = true;
    // step:
    // 1. load unparsed transactions per block from UnparsedTransaction
    // 2. check has unparsed transaction
    // 2-1. if no parse update balance
    // 2-2. if yes setJob
    // 3. update failed unparsed retry
    // 4. remove parsed transaction from UnparsedTransaction table

    await this.createJob();
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
        const height = data.result.height || '0';
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
    const source_addresses = [];
    const destination_addresses = [];
    let note = '';

    for (const inputData of tx.vin) {
      // if coinbase, continue
      if (inputData.txid) {
        const findUXTO = await this.utxoModel.findOne({ where: { txid: inputData.txid } });
        if (findUXTO) {
          from = from.plus(new BigNumber(findUXTO.amount));
        }

        // TODO: change use promise all
        const txInfo = await this.getTransactionByTxidFromPeer(inputData.txid);
        if (txInfo && txInfo.vout && txInfo.vout.length > inputData.vout) {
          if (txInfo.vout[inputData.vout].scriptPubKey && txInfo.vout[inputData.vout].scriptPubKey.addresses) {
            source_addresses.push({
              addresses: txInfo.vout[inputData.vout].scriptPubKey.addresses,
              amount: Utils.multipliedByDecimal(txInfo.vout[inputData.vout].value, this.decimal),
            });
            from = from.plus(new BigNumber(txInfo.vout[inputData.vout].value || '0'));
          } else if (txInfo.vout[inputData.vout].scriptPubKey && txInfo.vout[inputData.vout].scriptPubKey.type === 'pubkey') {
            // TODO: need pubkey => P2PK address
            source_addresses.push({
              addresses: txInfo.vout[inputData.vout].scriptPubKey.hex,
              amount: Utils.multipliedByDecimal(txInfo.vout[inputData.vout].value || '0', this.decimal),
            });
            from = from.plus(new BigNumber(txInfo.vout[inputData.vout].value || '0'));
          }
        }
      }
    }

    for (const outputData of tx.vout) {
      to = to.plus(new BigNumber(outputData.value));
      if (outputData.scriptPubKey && outputData.scriptPubKey.addresses) {
        destination_addresses.push({
          addresses: outputData.scriptPubKey.addresses,
          amount: Utils.multipliedByDecimal(outputData.value, this.decimal),
        });
      }
      if (outputData.scriptPubKey && outputData.scriptPubKey.asm && outputData.scriptPubKey.asm.slice(0, 9) === 'OP_RETURN1') {
        note = outputData.scriptPubKey.hex || '';
      } else if (outputData.scriptPubKey && outputData.scriptPubKey.type === 'pubkey') {
        // TODO: need pubkey => P2PK address
        destination_addresses.push({
          addresses: outputData.scriptPubKey.hex,
          amount: new BigNumber(outputData.value || '0', this.decimal),
        });
      }
    }

    return {
      from: Utils.multipliedByDecimal(from, this.decimal),
      to: Utils.multipliedByDecimal(to, this.decimal),
      fee: new BigNumber(from).minus(new BigNumber(to)),
      source_addresses: JSON.stringify(source_addresses),
      destination_addresses: JSON.stringify(destination_addresses),
      note,
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
    this.logger.debug(`[${this.constructor.name}] parseTx(${tx.txid})`);
    const {
      fee, to, source_addresses, destination_addresses, note,
    } = await BtcParserManagerBase.parseBTCTxAmounts.call(this, tx);

    await this.sequelize.transaction(async (transaction) => {
      // 1. insert tx
      const findTransaction = await this.transactionModel.findOrCreate({
        where: {
          currency_id: currencyInfo.currency_id,
          txid: tx.txid,
        },
        defaults: {
          currency_id: currencyInfo.currency_id,
          txid: tx.txid,
          timestamp: timestamp || null,
          source_addresses,
          destination_addresses,
          amount: to,
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
            result: tx.confirmations >= 6 ? true : null,
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
            where: { address },
            include: [
              {
                model: this.accountModel,
                attributes: ['blockchain_id'],
                where: { blockchain_id: this.bcid },
              },
            ],
            transaction,
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
                transaction_id: findTransaction[0].transaction_id,
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
              to_tx: findTransaction[0].transaction_id,
              on_block_timestamp: tx.timestamp,
            },
            {
              where: {
                utxo_id: findExistUTXO.utxo_id,
              },
              transaction,
            });
          }
        }
      }

      // 4. check from address is regist address
      const _source_addresses = JSON.parse(source_addresses);
      for (let i = 0; i < _source_addresses.length; i++) {
        const sourceAddress = Array.isArray(_source_addresses[i].addresses) ? _source_addresses[i].addresses[0] : _source_addresses[i].addresses;
        const sourceAddressAmount = Utils.dividedByDecimal(new BigNumber(_source_addresses[i].amount), currencyInfo.decimals);
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
          this.updateBalanceAccounts[accountAddressFrom.account_id] = { retryCount: 0 };

          // 5. add mapping table
          await this.addressTransactionModel.findOrCreate({
            where: {
              currency_id: currencyInfo.currency_id,
              accountAddress_id: accountAddressFrom.accountAddress_id,
              transaction_id: findTransaction[0].transaction_id,
              direction: 0,
            },
            defaults: {
              currency_id: currencyInfo.currency_id,
              accountAddress_id: accountAddressFrom.accountAddress_id,
              transaction_id: findTransaction[0].transaction_id,
              amount: sourceAddressAmount,
              direction: 0,
            },
            transaction,
          });
        }
      }
      // 6. check to address is regist address
      const _destination_addresses = JSON.parse(destination_addresses);
      for (let i = 0; i < _destination_addresses.length; i++) {
        const destinationAddress = Array.isArray(_destination_addresses[i].addresses) ? _destination_addresses[i].addresses[0] : _destination_addresses[i].addresses;
        const destinationAddressAmount = Utils.dividedByDecimal(new BigNumber(_destination_addresses[i].amount), currencyInfo.decimals);
        const accountAddressTo = await this.accountAddressModel.findOne({
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
        if (accountAddressTo) {
          this.updateBalanceAccounts[accountAddressTo.account_id] = { retryCount: 0 };

          // 7. add mapping table
          await this.addressTransactionModel.findOrCreate({
            where: {
              currency_id: currencyInfo.currency_id,
              accountAddress_id: accountAddressTo.accountAddress_id,
              transaction_id: findTransaction[0].transaction_id,
              direction: 1,
            },
            defaults: {
              currency_id: currencyInfo.currency_id,
              accountAddress_id: accountAddressTo.accountAddress_id,
              transaction_id: findTransaction[0].transaction_id,
              amount: destinationAddressAmount,
              direction: 1,
            },
            transaction,
          });

          // 8. if vout has account change address, update number_of_internal_key += 1
          if (accountAddressTo.chain_index === 1) {
            const accountCurrency = await this.accountCurrencyModel.increment(
              { number_of_internal_key: 1 },
              {
                where: {
                  account_id: accountAddressTo.Account.account_id,
                  currency_id: currencyInfo.currency_id,
                },
                transaction,
              },
            );

            if (accountCurrency && accountCurrency.length > 0 && accountCurrency[0] && accountCurrency[0][0] && accountCurrency[0][0][0]) {
              const hdWallet = new HDWallet({ extendPublicKey: accountAddressTo.Account.extend_public_key });
              const coinType = accountAddressTo.Account.Blockchain.coin_type;
              const wallet = hdWallet.getWalletInfo({
                change: 1,
                index: accountCurrency[0][0][0].number_of_internal_key,
                coinType,
                blockchainID: accountAddressTo.Account.blockchain_id,
              });

              await this.accountAddressModel.create({
                accountAddress_id: uuidv4(),
                account_id: accountAddressTo.Account.account_id,
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
    // 2. update balance
    try {
      await this.parsePendingTransaction();
      // update balance
      for (const accountID of Object.keys(this.updateBalanceAccounts)) {
        if (this.updateBalanceAccounts[accountID] && this.updateBalanceAccounts[accountID].retryCount < 3) {
          const findAllAddress = await this.accountAddressModel.findAll({
            where: { account_id: accountID },
            attributes: ['accountAddress_id'],
          });
          let balance = new BigNumber(0);
          for (const addressItem of findAllAddress) {
            const findUTXOByAddress = await this.utxoModel.findAll({
              where: { accountAddress_id: addressItem.accountAddress_id, to_tx: { [this.Sequelize.Op.not]: false } },
              attributes: ['amount'],
            });

            for (const utxoItem of findUTXOByAddress) {
              balance = balance.plus(new BigNumber(utxoItem.amount));
            }
          }

          try {
            await this.accountCurrencyModel.update({
              balance: balance.toFixed(),
            },
            {
              where: {
                account_id: accountID,
                currency_id: this.currencyInfo.currency_id,
              },
            });

            delete this.updateBalanceAccounts[accountID];
          } catch (e) {
            this.updateBalanceAccounts[accountID].retryCount += 1;
          }
        } else {
          this.logger.error(`this.updateBalanceAccounts[${accountID}] update error!`);
          this.updateBalanceAccounts[accountID].retryCount += 1;

          // if error after 3 block, reset retryCount, and retry it
          if (this.updateBalanceAccounts[accountID].retryCount > 6) {
            this.updateBalanceAccounts[accountID].retryCount = 0;
          }
        }
      }
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
    // 4. update result which is not in step 2 array
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
          await BtcParserManagerBase.parseTx.call(this, tx, this.currencyInfo, tx.time);
        } catch (error) {
          this.logger.debug(`[${this.constructor.name}] parsePendingTransaction create transaction(${txid}) error: ${error}`);
        }
      }

      // 4. update result which is not in step 2 array
      const missingTxs = transactions.filter((transaction) => (pendingTxids.every((pendingTxid) => pendingTxid !== transaction.txid) && this.block - transaction.block >= 6));
      for (const tx of missingTxs) {
        try {
          if (tx.block) {
            await this.transactionModel.update(
              {
                result: true,
              },
              {
                where: {
                  currency_id: this.currencyInfo.currency_id,
                  txid: tx.txid,
                },
              },
            );
          } else {
            const peerTx = await this.getTransactionByTxidFromPeer(tx.txid).catch((error) => error);
            if (peerTx.blockhash) {
              const blockData = await this.blockDataFromDB(peerTx.blockhash);
              tx.block = blockData.block;
              tx.timestamp = peerTx.blocktime;
              tx.result = tx.confirmations >= 6 ? true : null;
            } else if (peerTx.code === -5) {
              tx.result = false;
            }
            await this.transactionModel.update(
              {
                block: tx.block,
                timestamp: tx.timestamp,
                result: tx.result,
              },
              {
                where: {
                  currency_id: this.currencyInfo.currency_id,
                  txid: tx.txid,
                },
              },
            );
          }

          const findAddressTransaction = await this.addressTransactionModel.findOne({
            include: [
              {
                model: this.transactionModel,
                attributes: ['transaction_id', 'txid', 'currency_id'],
                where: {
                  currency_id: this.currencyInfo.currency_id,
                  txid: tx.txid,
                },
              },
              {
                model: this.accountAddressModel,
                attributes: ['account_id'],
              },
            ],
            attributes: ['addressTransaction_id', 'currency_id', 'transaction_id'],
          });
          if (findAddressTransaction) {
            this.updateBalanceAccounts[findAddressTransaction.AccountAddress.account_id] = { retryCount: 0 };
          }
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
    type, txid, block_hash,
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
      case 'getBlockHeight':
        result = {
          jsonrpc: '1.0',
          method: 'getblockstats',
          params: [block_hash, ['height']],
          id: dvalue.randomID(),
        };
        break;
      default:
        result = {};
    }
    return result;
  }
}

module.exports = BtcParserManagerBase;
