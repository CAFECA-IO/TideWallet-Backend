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
    this.decimal = 8;

    this.updateBalanceAccounts = {};
  }

  async init() {
    await super.init();
    this.isParsing = false;
    return this;
  }

  async doJob(job) {
    try {
      const unParsedTx = job;
      const transaction = JSON.parse(unParsedTx.transaction);
      // await this.parseTx(transaction, unParsedTx.timestamp);
      await BtcParserBase.parseTx.call(this, transaction, this.currencyInfo, unParsedTx.timestamp);

      job.success = true;
      job.updateBalanceAccounts = this.updateBalanceAccounts;
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] doJob error: ${error}`);
      job.success = false;
    }
    return job;
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

  static async getTransactionByTxidFromPeer(txid) {
    this.logger.debug(`[${this.constructor.name}] getTransactionByTxidFromPeer(${txid})`);

    const blockchainConfig = Utils.getBlockchainConfig(this.bcid);
    const options = { ...blockchainConfig };
    options.data = {
      jsonrpc: '1.0',
      method: 'getrawtransaction',
      params: [txid, true],
      id: dvalue.randomID(),
    };
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

    const arr = [];
    const vins = [];
    for (const inputData of tx.vin) {
      // if coinbase, continue
      if (inputData.txid) {
        arr.push(BtcParserBase.getTransactionByTxidFromPeer.call(this, inputData.txid));
        vins.push(inputData);
      }
    }
    const txInfos = await Promise.all(arr).catch((error) => Promise.reject(error));

    if (!txInfos) { throw new Error('parseBTCTxAmounts something wrong'); }
    for (let i = 0; i < vins.length; i++) {
      const inputData = vins[i];
      const txInfo = txInfos[i];
      if (inputData.txid) {
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
          amount: Utils.multipliedByDecimal(outputData.value || '0', this.decimal),
        });
      }
    }

    // if from = 0, it from COINBASE
    const fee = from === new BigNumber(0) ? new BigNumber(0) : new BigNumber(from).minus(new BigNumber(to));
    return {
      from: Utils.multipliedByDecimal(from, this.decimal),
      to: Utils.multipliedByDecimal(to, this.decimal),
      fee,
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
    // 8. if vout has account address, and the key index is newest, update number_of_internal_key or number_of_external_key += 1
    this.logger.debug(`[${this.constructor.name}] parseTx(${tx.txid})`);
    const {
      fee, to, source_addresses, destination_addresses, note,
    } = await BtcParserBase.parseBTCTxAmounts.call(this, tx);

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
          result: tx.confirmations >= 6,
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
              txid: inputData.txid,
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
        const sourceAddressAmount = _source_addresses[i].amount;
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
        const destinationAddressAmount = _destination_addresses[i].amount;
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

          // 8. if vout has account address, and the key index is newest, update number_of_internal_key or number_of_external_key += 1
          const accountCurrency = await this.accountCurrencyModel.findOne(
            {
              where: {
                account_id: accountAddressTo.Account.account_id,
                currency_id: currencyInfo.currency_id,
              },
              transaction,
            },
          );
          if (accountAddressTo.chain_index === 1 && accountCurrency && (accountCurrency.number_of_internal_key === accountAddressTo.key_index)) {
            const newAccountCurrency = await this.accountCurrencyModel.increment(
              { number_of_internal_key: 1 },
              {
                where: {
                  account_id: accountAddressTo.Account.account_id,
                  currency_id: currencyInfo.currency_id,
                },
                transaction,
              },
            );

            if (newAccountCurrency && newAccountCurrency.length > 0 && newAccountCurrency[0] && newAccountCurrency[0][0] && newAccountCurrency[0][0][0]) {
              const hdWallet = new HDWallet({ extendPublicKey: accountAddressTo.Account.extend_public_key });
              const coinType = accountAddressTo.Account.Blockchain.coin_type;
              const wallet = hdWallet.getWalletInfo({
                change: 1,
                index: newAccountCurrency[0][0][0].number_of_internal_key,
                coinType,
                blockchainID: accountAddressTo.Account.blockchain_id,
              });

              await this.accountAddressModel.create({
                accountAddress_id: uuidv4(),
                account_id: accountAddressTo.Account.account_id,
                chain_index: 1,
                key_index: newAccountCurrency[0][0][0].number_of_internal_key,
                public_key: wallet.publicKey,
                address: wallet.address,
              });
            }
          }
          if (accountAddressTo.chain_index === 0 && accountCurrency && (accountCurrency.number_of_external_key === accountAddressTo.key_index)) {
            const newAccountCurrency = await this.accountCurrencyModel.increment(
              { number_of_external_key: 1 },
              {
                where: {
                  account_id: accountAddressTo.Account.account_id,
                  currency_id: currencyInfo.currency_id,
                },
                transaction,
              },
            );

            if (newAccountCurrency && newAccountCurrency.length > 0 && newAccountCurrency[0] && newAccountCurrency[0][0] && newAccountCurrency[0][0][0]) {
              const hdWallet = new HDWallet({ extendPublicKey: accountAddressTo.Account.extend_public_key });
              const coinType = accountAddressTo.Account.Blockchain.coin_type;
              const wallet = hdWallet.getWalletInfo({
                change: 0,
                index: newAccountCurrency[0][0][0].number_of_external_key,
                coinType,
                blockchainID: accountAddressTo.Account.blockchain_id,
              });

              await this.accountAddressModel.create({
                accountAddress_id: uuidv4(),
                account_id: accountAddressTo.Account.account_id,
                chain_index: 0,
                key_index: newAccountCurrency[0][0][0].number_of_external_key,
                public_key: wallet.publicKey,
                address: wallet.address,
              });
            }
          }
        }
      }
    });
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

module.exports = BtcParserBase;
