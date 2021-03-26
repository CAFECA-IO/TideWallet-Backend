const { v4: uuidv4 } = require('uuid');
const BigNumber = require('bignumber.js');
const ecrequest = require('ecrequest');
const ResponseFormat = require('./ResponseFormat');
const Bot = require('./Bot.js');
const Utils = require('./Utils');
const Codes = require('./Codes');
const HDWallet = require('./HDWallet');

class Account extends Bot {
  constructor() {
    super();
    this.name = 'Account';
    this.tags = {};
  }

  init({
    config, database, logger, i18n,
  }) {
    return super.init({
      config, database, logger, i18n,
    }).then(() => {
      this.userModel = this.database.db.User;
      this.blockchainModel = this.database.db.Blockchain;
      this.tokenSecretModel = this.database.db.TokenSecret;
      this.currencyModel = this.database.db.Currency;
      this.accountModel = this.database.db.Account;
      this.accountCurrencyModel = this.database.db.AccountCurrency;
      this.accountAddressModel = this.database.db.AccountAddress;
      this.addressTransactionModel = this.database.db.AddressTransaction;
      this.transactionModel = this.database.db.Transaction;
      this.addressTokenTransactionModel = this.database.db.AddressTokenTransaction;
      this.tokenTransactionModel = this.database.db.TokenTransaction;
      this.deviceModel = this.database.db.Device;
      this.utxoModel = this.database.db.UTXO;

      this.sequelize = this.database.db.sequelize;
      this.Sequelize = this.database.db.Sequelize;
      return this;
    });
  }

  async TokenRegist({ params, token }) {
    try {
      const { blockchain_id, contract = '' } = params;
      if (!Utils.validateString(contract)) {
        return new ResponseFormat({ message: 'invalid input', code: Codes.INVALID_INPUT });
      }

      if (!token) return new ResponseFormat({ message: 'invalid token', code: Codes.INVALID_ACCESS_TOKEN });
      const tokenInfo = await Utils.verifyToken(token);

      // find Token is exist
      let findTokenItem = await this.currencyModel.findOne({
        where: { type: 2, contract },
      });

      if (!findTokenItem) {
        // use contract check Token is exist
        findTokenItem = await this.currencyModel.findOne({
          where: { type: 2, contract },
        });
        if (findTokenItem) {
          // check account token is exist
          const findUserAccountData = await this.accountModel.findOne({
            where: {
              user_id: tokenInfo.userID, blockchain_id,
            },
          });

          if (!findUserAccountData) return new ResponseFormat({ message: 'account not found', code: Codes.ACCOUNT_NOT_FOUND });
          // check account currency
          const findUserAccountToken = await this.accountCurrencyModel.findOne({
            where: {
              account_id: findUserAccountData.account_id, currency_id: findTokenItem.currency_id,
            },
          });
          if (findUserAccountToken) return new ResponseFormat({ message: 'account token exist', code: Codes.ACCOUNT_TOKEN_EXIST });
        } else {
          // if not found token in DB, parse token contract info from blockchain

          let options = '';
          switch (blockchain_id) {
            case '8000003C':
              options = this.config.blockchain.ethereum_mainnet;
              break;
            case '8000025B':
              options = this.config.blockchain.ethereum_testnet;
              break;
            case '80000CFC':
              options = this.config.blockchain.cafeca;
              break;
            default:
              return new ResponseFormat({ message: 'blockchain has not token', code: Codes.BLOCKCHAIN_HAS_NOT_TOKEN });
          }

          const tokenInfoFromPeer = await Promise.all([
            Utils.getTokenNameFromPeer(options, contract),
            Utils.getTokenSymbolFromPeer(options, contract),
            Utils.getTokenDecimalFromPeer(options, contract),
            Utils.getTokenTotalSupplyFromPeer(options, contract),
          ]).catch((error) => new ResponseFormat({ message: `rpc error(${error})`, code: Codes.RPC_ERROR }));
          if (tokenInfoFromPeer.code === Codes.RPC_ERROR) return tokenInfoFromPeer;

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

          let total_supply = tokenInfoFromPeer[3];
          try {
            total_supply = new BigNumber(tokenInfoFromPeer[3]).dividedBy(new BigNumber(10 ** tokenInfoFromPeer[2])).toFixed({
              groupSeparator: ',', groupSize: 3,
            });
            // eslint-disable-next-line no-empty
          } catch (e) {
          }

          const newCurrencyID = uuidv4();
          if (!Array.isArray(tokenInfoFromPeer) || !tokenInfoFromPeer[0] || !tokenInfoFromPeer[1] || !(tokenInfoFromPeer[2] >= 0) || !tokenInfoFromPeer[3]) return new ResponseFormat({ message: 'contract not found', code: Codes.CONTRACT_CONT_FOUND });
          findTokenItem = await this.currencyModel.create({
            currency_id: newCurrencyID,
            blockchain_id,
            name: tokenInfoFromPeer[0],
            symbol: tokenInfoFromPeer[1],
            type: 2,
            publish: false,
            decimals: tokenInfoFromPeer[2],
            total_supply,
            contract,
            icon,
          });
        }
      }
      // check account token is exist
      const findUserAccountData = await this.accountModel.findOne({
        where: {
          user_id: tokenInfo.userID, blockchain_id,
        },
      });
      if (!findUserAccountData) return new ResponseFormat({ message: 'account not found', code: Codes.ACCOUNT_NOT_FOUND });

      const { currency_id } = findTokenItem;
      const findUserAccountToken = await this.accountCurrencyModel.findOne({
        where: {
          account_id: findUserAccountData.account_id, currency_id,
        },
      });
      if (findUserAccountToken) return new ResponseFormat({ message: 'account token exist', code: Codes.ACCOUNT_TOKEN_EXIST });
      // create token data to db
      try {
        const token_account_id = uuidv4();
        await this.accountCurrencyModel.create({
          accountCurrency_id: token_account_id,
          account_id: findUserAccountData.account_id,
          currency_id: findTokenItem.currency_id,
          balance: '0',
          number_of_external_key: '0',
          number_of_internal_key: '0',
        });

        return new ResponseFormat({ message: 'Account Token Regist', payload: { token_id: currency_id } });
      } catch (e) {
        return new ResponseFormat({ message: `DB Error(${e.message})`, code: Codes.DB_ERROR });
      }
    } catch (e) {
      this.logger.error('TokenRegist e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: `DB Error(${e.message})`, code: Codes.DB_ERROR });
    }
  }

  async AccountList({ token }) {
    if (!token) return new ResponseFormat({ message: 'invalid token', code: Codes.INVALID_ACCESS_TOKEN });
    const tokenInfo = await Utils.verifyToken(token);
    const payload = [];

    try {
      const findAccounts = await this.accountModel.findAll({
        where: {
          user_id: tokenInfo.userID,
        },
        include: [
          {
            model: this.blockchainModel,
            attributes: ['network_id'],
          },
        ],
      });

      for (let i = 0; i < findAccounts.length; i++) {
        const account = findAccounts[i];
        const findAccountCurrencies = await this.accountCurrencyModel.findAll({
          where: {
            account_id: account.account_id,
          },
          include: [
            {
              model: this.currencyModel,
              attributes: ['type', 'publish', 'decimals'],
              where: {
                type: 1,
              },
            },
          ],
        });
        for (let j = 0; j < findAccountCurrencies.length; j++) {
          const accountCurrency = findAccountCurrencies[j];
          let { balance } = accountCurrency;
          const { Currency, currency_id, accountCurrency_id } = accountCurrency;

          if (account.blockchain_id === '8000025B' || account.blockchain_id === '8000003C' || account.blockchain_id === '80000CFC') {
            // if ETH symbol && balance_sync_block < findBlockHeight, request RPC get balance
            const findBlockHeight = await this.blockchainModel.findOne({ where: { blockchain_id: account.blockchain_id } });
            if (Number(accountCurrency.balance_sync_block) < Number(findBlockHeight.block)) {
              const findAddress = await this.accountAddressModel.findOne({
                where: { account_id: account.account_id },
                attributes: ['address'],
              });
              if (findAddress) {
                balance = await Utils.ethGetBalanceByAddress(account.blockchain_id, findAddress.address, Currency.decimals);

                await this.accountCurrencyModel.update(
                  { balance, balance_sync_block: findBlockHeight.block },
                  { where: { accountCurrency_id: accountCurrency.accountCurrency_id } },
                );
              }
            } else {
              balance = accountCurrency.balance;
            }
          }

          payload.push({
            account_id: accountCurrency_id,
            blockchain_id: account.blockchain_id,
            network_id: account.Blockchain.network_id,
            currency_id,
            balance,
            publish: Currency.publish,
            account_index: '0',
          });
        }
      }
      return new ResponseFormat({ message: 'Get Account List', payload });
    } catch (e) {
      this.logger.error('AccountList e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: `DB Error(${e.message})`, code: Codes.DB_ERROR });
    }
  }

  async AccountDetail({ token, params }) {
    if (!token) return new ResponseFormat({ message: 'invalid token', code: Codes.INVALID_ACCESS_TOKEN });
    const tokenInfo = await Utils.verifyToken(token);

    // account_id -> accountCurrency_id
    const { account_id } = params;
    if (!Utils.validateString(account_id)) return new ResponseFormat({ message: 'invalid input', code: Codes.INVALID_INPUT });
    const payload = {};
    const tokens = [];

    try {
      // check user has this account currency & accountCurrency_id exist
      const findAccountCurrency = await this.accountCurrencyModel.findOne({
        where: {
          accountCurrency_id: account_id,
        },
        include: [
          {
            model: this.accountModel,
            where: {
              user_id: tokenInfo.userID,
            },
          },
        ],
      });
      if (!findAccountCurrency) return new ResponseFormat({ message: 'account not found', code: Codes.ACCOUNT_NOT_FOUND });

      const findAccount = findAccountCurrency.Account;

      // find account currencies info
      const findAccountCurrencies = await this.accountCurrencyModel.findAll({
        where: {
          account_id: findAccount.account_id,
        },
        include: [
          {
            model: this.currencyModel,
            attributes: ['currency_id', 'name', 'symbol', 'type', 'publish', 'decimals', 'total_supply', 'contract', 'icon'],
            where: {
              [this.Sequelize.Op.or]: [{ type: 1 }, { type: 2 }],
            },
          },
        ],
      });
      for (let j = 0; j < findAccountCurrencies.length; j++) {
        const accountCurrency = findAccountCurrencies[j];
        let { balance = '0' } = accountCurrency;
        if (findAccount.blockchain_id === '8000025B' || findAccount.blockchain_id === '8000003C' || findAccount.blockchain_id === '80000CFC') {
          // if ETH symbol && balance_sync_block < findBlockHeight, request RPC get balance
          const findBlockHeight = await this.blockchainModel.findOne({ where: { blockchain_id: findAccount.blockchain_id } });
          if (Number(accountCurrency.balance_sync_block) < Number(findBlockHeight.block)) {
            const findAddress = await this.accountAddressModel.findOne({
              where: { account_id: findAccount.account_id },
              attributes: ['address'],
            });
            if (findAddress) {
              if (accountCurrency.Currency.contract) {
                balance = await Utils.getERC20Token(findAccount.blockchain_id, findAddress.address, accountCurrency.Currency.contract, accountCurrency.Currency.decimals);
              } else {
                balance = await Utils.ethGetBalanceByAddress(findAccount.blockchain_id, findAddress.address, accountCurrency.Currency.decimals);
              }
              await this.accountCurrencyModel.update(
                { balance, balance_sync_block: findBlockHeight.block },
                { where: { accountCurrency_id: accountCurrency.accountCurrency_id } },
              );
            } else {
              balance = accountCurrency.balance;
            }
          }
        }

        if (accountCurrency.Currency && accountCurrency.Currency.type === 1) {
          payload.blockchain_id = findAccount.blockchain_id;
          payload.currency_id = accountCurrency.currency_id;
          payload.account_id = accountCurrency.accountCurrency_id;
          payload.purpose = findAccount.purpose;
          payload.account_index = '0';
          payload.curve_type = findAccount.curve_type;
          payload.number_of_external_key = findAccount.number_of_external_key;
          payload.number_of_internal_key = findAccount.number_of_internal_key;
          payload.balance = balance;
          payload.symbol = accountCurrency.Currency.symbol;
          payload.icon = accountCurrency.Currency.icon;
        } else if (accountCurrency.Currency && accountCurrency.Currency.type === 2) {
          tokens.push({
            account_token_id: accountCurrency.accountCurrency_id,
            token_id: accountCurrency.Currency.currency_id,
            blockchain_id: findAccount.blockchain_id,
            name: accountCurrency.Currency.name,
            symbol: accountCurrency.Currency.symbol,
            type: accountCurrency.Currency.type,
            publish: accountCurrency.Currency.publish,
            decimals: accountCurrency.Currency.decimals,
            total_supply: accountCurrency.Currency.total_supply,
            contract: accountCurrency.Currency.contract,
            balance,
          });
        }
      }
      payload.tokens = tokens;
      return new ResponseFormat({ message: 'Get Account List', payload });
    } catch (e) {
      this.logger.error('AccountDetail e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: `DB Error(${e.message})`, code: Codes.DB_ERROR });
    }
  }

  async AccountReceive({ params, token }) {
    // account_id -> accountCurrency_id
    const { account_id } = params;
    if (!Utils.validateString(account_id)) return new ResponseFormat({ message: 'invalid input', code: Codes.INVALID_INPUT });

    if (!token) return new ResponseFormat({ message: 'invalid token', code: Codes.INVALID_ACCESS_TOKEN });
    const tokenInfo = await Utils.verifyToken(token);

    try {
      const findAccountCurrency = await this.accountCurrencyModel.findOne({
        where: { accountCurrency_id: account_id },
        include: [
          {
            model: this.accountModel,
            attributes: ['account_id', 'user_id', 'extend_public_key'],
            where: {
              user_id: tokenInfo.userID,
            },
            include: [
              {
                model: this.blockchainModel,
                attributes: ['blockchain_id', 'block', 'coin_type'],
              },
            ],
          },
        ],
      });
      if (!findAccountCurrency) return new ResponseFormat({ message: 'account not found', code: Codes.ACCOUNT_NOT_FOUND });

      const findReceiveAddress = await this.accountAddressModel.findOne({
        where: {
          account_id: findAccountCurrency.Account.account_id,
          chain_index: 0,
          key_index: findAccountCurrency.number_of_external_key,
        },
      });

      const hdWallet = new HDWallet({ extendPublicKey: findAccountCurrency.Account.extend_public_key });
      // if index address not found
      let { address } = findReceiveAddress || {};
      if (!findReceiveAddress) {
        const coinType = findAccountCurrency.Account.Blockchain.coin_type;
        const wallet = hdWallet.getWalletInfo({
          change: 0,
          index: findAccountCurrency.number_of_external_key,
          coinType,
          blockchainID: findAccountCurrency.Account.Blockchain.blockchain_id,
        });

        await this.accountAddressModel.create({
          accountAddress_id: uuidv4(),
          account_id: findAccountCurrency.Account.account_id,
          chain_index: 0,
          key_index: 0,
          public_key: wallet.publicKey,
          address: wallet.address,
        });

        address = wallet.address;
      }

      return new ResponseFormat({
        message: 'Get Receive Address',
        payload: {
          address,
          key_index: findAccountCurrency.number_of_external_key,
        },
      });
    } catch (e) {
      this.logger.error('AccountReceive e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: `DB Error(${e.message})`, code: Codes.DB_ERROR });
    }
  }

  async AccountChange({ params, token }) {
    // account_id -> accountCurrency_id
    const { account_id } = params;
    if (!Utils.validateString(account_id)) return new ResponseFormat({ message: 'invalid input', code: Codes.INVALID_INPUT });

    if (!token) return new ResponseFormat({ message: 'invalid token', code: Codes.INVALID_ACCESS_TOKEN });
    const tokenInfo = await Utils.verifyToken(token);

    try {
      const findAccountCurrency = await this.accountCurrencyModel.findOne({
        where: { accountCurrency_id: account_id },
        include: [
          {
            model: this.accountModel,
            attributes: ['account_id', 'user_id', 'extend_public_key'],
            where: {
              user_id: tokenInfo.userID,
            },
            include: [
              {
                model: this.blockchainModel,
                attributes: ['blockchain_id', 'block', 'coin_type'],
              },
            ],
          },
        ],
      });
      if (!findAccountCurrency) return new ResponseFormat({ message: 'account not found', code: Codes.ACCOUNT_NOT_FOUND });

      let chain_index = 0;
      // only BTC has change address
      switch (findAccountCurrency.Account.Blockchain.blockchain_id) {
        case '80000000':
        case '80000001':
          chain_index = 1;
          break;
        default:
          break;
      }

      const findChangeAddress = await this.accountAddressModel.findOne({
        where: {
          account_id: findAccountCurrency.Account.account_id,
          chain_index,
          key_index: findAccountCurrency.number_of_internal_key,
        },
      });

      const hdWallet = new HDWallet({ extendPublicKey: findAccountCurrency.Account.extend_public_key });
      // if index address not found
      let { address } = findChangeAddress || {};
      if (!findChangeAddress) {
        const coinType = findAccountCurrency.Account.Blockchain.coin_type;
        const wallet = hdWallet.getWalletInfo({
          change: chain_index,
          index: findAccountCurrency.number_of_internal_key,
          coinType,
          blockchainID: findAccountCurrency.Account.Blockchain.blockchain_id,
        });

        await this.accountAddressModel.create({
          accountAddress_id: uuidv4(),
          account_id: findAccountCurrency.Account.account_id,
          chain_index: 1,
          key_index: 0,
          public_key: wallet.publicKey,
          address: wallet.address,
        });

        address = wallet.address;
      }

      return new ResponseFormat({
        message: 'Get Change Address',
        payload: {
          address,
          key_index: findAccountCurrency.number_of_internal_key,
        },
      });
    } catch (e) {
      this.logger.error('AccountChange e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: `DB Error(${e.message})`, code: Codes.DB_ERROR });
    }
  }

  async _findAccountTXs({
    findAccountCurrency, txs, chain_index, key_index,
  }) {
    const isToken = findAccountCurrency.Currency.type === 2;
    const findAccountAddress = await this.accountAddressModel.findOne({
      where: { account_id: findAccountCurrency.account_id, chain_index, key_index },
    });
    // find all tx by address
    if (findAccountAddress) {
      if (isToken) {
        const findTxByAddress = await this.addressTokenTransactionModel.findAll({
          where: {
            currency_id: findAccountCurrency.currency_id,
            accountAddress_id: findAccountAddress.accountAddress_id,
          },
          include: [
            {
              model: this.tokenTransactionModel,
              include: [
                {
                  model: this.transactionModel,
                },
              ],
            },
          ],
        });
        if (findTxByAddress && findTxByAddress.length > 0) {
          for (let j = 0; j < findTxByAddress.length; j++) {
            const txInfo = findTxByAddress[j];
            const amount = Utils.dividedByDecimal(txInfo.amount, findAccountCurrency.Currency.decimals);
            const gas_price = txInfo.TokenTransaction.Transaction.gas_price
              ? Utils.dividedByDecimal(txInfo.TokenTransaction.Transaction.gas_price, findAccountCurrency.Currency.decimals)
              : null;
            const fee = txInfo.TokenTransaction.Transaction.fee
              ? Utils.dividedByDecimal(txInfo.TokenTransaction.Transaction.fee, findAccountCurrency.Currency.decimals)
              : null;
            txs.push({
              txid: txInfo.TokenTransaction.Transaction.txid,
              // eslint-disable-next-line no-nested-ternary
              status: (isToken) ? (txInfo.TokenTransaction.result ? 'success' : 'failed') : 'success',
              amount,
              symbol: findAccountCurrency.Currency.symbol, // "unit"
              direction: txInfo.TokenTransaction.direction === 0 ? 'send' : 'receive',
              confirmations: findAccountCurrency.Account.Blockchain.block - txInfo.TokenTransaction.Transaction.block,
              timestamp: txInfo.TokenTransaction.timestamp,
              source_addresses: Utils.formatAddressArray(txInfo.TokenTransaction.source_addresses),
              destination_addresses: Utils.formatAddressArray(txInfo.TokenTransaction.destination_addresses),
              fee,
              gas_price,
              gas_used: txInfo.TokenTransaction.Transaction.gas_used,
              note: txInfo.TokenTransaction.Transaction.note,
            });
          }
        }
      } else {
        const findTxByAddress = await this.addressTransactionModel.findAll({
          where: {
            currency_id: findAccountCurrency.currency_id,
            accountAddress_id: findAccountAddress.accountAddress_id,
          },
          include: [
            {
              model: this.transactionModel,
            },
          ],
        });
        if (findTxByAddress) {
          for (let j = 0; j < findTxByAddress.length; j++) {
            const txInfo = findTxByAddress[j];
            const amount = Utils.dividedByDecimal(txInfo.amount, findAccountCurrency.Currency.decimals);
            const gas_price = txInfo.Transaction.gas_price
              ? Utils.dividedByDecimal(txInfo.Transaction.gas_price, findAccountCurrency.Currency.decimals)
              : null;
            const fee = txInfo.Transaction.fee
              ? Utils.dividedByDecimal(txInfo.Transaction.fee, findAccountCurrency.Currency.decimals)
              : null;

            txs.push({
              txid: txInfo.Transaction.txid,
              // eslint-disable-next-line no-nested-ternary
              status: (isToken) ? findTxByAddress.result ? 'success' : 'failed' : 'success',
              amount,
              symbol: findAccountCurrency.Currency.symbol, // "unit"
              direction: txInfo.direction === 0 ? 'send' : 'receive',
              confirmations: findAccountCurrency.Account.Blockchain.block - txInfo.Transaction.block,
              timestamp: txInfo.Transaction.timestamp,
              source_addresses: Utils.formatAddressArray(txInfo.Transaction.source_addresses),
              destination_addresses: Utils.formatAddressArray(txInfo.Transaction.destination_addresses),
              fee,
              gas_price,
              gas_used: txInfo.Transaction.gas_used,
              note: txInfo.Transaction.note,
            });
          }
        }
      }
    }
  }

  _mergeInternalTxs({ txs }) {
    const tmpTxs = {};
    txs.forEach((tx) => {
      if (!tmpTxs[tx.txid]) {
        const amount = (tx.direction === 'send') ? new BigNumber(tx.amount) : new BigNumber(0).minus(new BigNumber(tx.amount));
        tmpTxs[tx.txid] = { tx, amount, same: 0 };
      } else {
        let { amount } = tmpTxs[tx.txid];
        if (tx.direction === 'send') {
          amount = amount.plus(new BigNumber(tx.amount));
        } else {
          amount = amount.minus(new BigNumber(tx.amount));
        }

        tmpTxs[tx.txid].amount = amount;
        tmpTxs[tx.txid].direction = 'send';
        tmpTxs[tx.txid].same = 1;
      }
    });

    const result = [];
    Object.keys(tmpTxs).forEach((key) => {
      if (tmpTxs[key].same) {
        tmpTxs[key].tx.amount = tmpTxs[key].amount.abs().minus(new BigNumber(tmpTxs[key].tx.fee)).toFixed();
      } else {
        tmpTxs[key].tx.amount = tmpTxs[key].amount.abs().toFixed();
      }
      result.push(tmpTxs[key].tx);
    });

    return result;
  }

  async ListTransactions({ params, token }) {
    // account_id -> accountCurrency_id
    const { account_id } = params;

    if (!token) return new ResponseFormat({ message: 'invalid token', code: Codes.INVALID_ACCESS_TOKEN });
    const tokenInfo = await Utils.verifyToken(token);
    try {
      const findAccountCurrency = await this.accountCurrencyModel.findOne({
        where: { accountCurrency_id: account_id },
        include: [
          {
            model: this.accountModel,
            attributes: ['account_id', 'user_id'],
            where: {
              user_id: tokenInfo.userID,
            },
            include: [
              {
                model: this.blockchainModel,
                attributes: ['blockchain_id', 'block', 'coin_type'],
              },
            ],
          },
          {
            model: this.currencyModel,
            attributes: ['type', 'symbol', 'decimals'],
          },
        ],
      });

      if (!findAccountCurrency) return new ResponseFormat({ message: 'account not found', code: Codes.ACCOUNT_NOT_FOUND });

      const { number_of_external_key, number_of_internal_key } = findAccountCurrency;
      const result = [];
      // find external address txs
      for (let i = 0; i <= number_of_external_key; i++) {
        // find all address
        await this._findAccountTXs({
          findAccountCurrency, txs: result, chain_index: 0, key_index: i,
        });
      }

      // find internal address txs
      for (let i = 0; i <= number_of_internal_key; i++) {
        await this._findAccountTXs({
          findAccountCurrency, txs: result, chain_index: 1, key_index: i,
        });
      }

      // merge internal txs
      // const payload = this._mergeInternalTxs({ txs: result });

      // sort by timestamps
      const payload = result.sort((a, b) => b.timestamp - a.timestamp);

      return new ResponseFormat({
        message: 'List Transactions',
        payload,
      });
    } catch (e) {
      this.logger.error('ListTransactions e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: `DB Error(${e.message})`, code: Codes.DB_ERROR });
    }
  }

  async TransactionDetail({ params }) {
    const { txid } = params;

    try {
      // find Transaction table
      const findTX = await this.transactionModel.findOne({
        where: { txid },
        include: [
          {
            model: this.currencyModel,
            attributes: ['currency_id', 'symbol', 'decimals'],
            include: [
              {
                model: this.blockchainModel,
                attributes: ['blockchain_id', 'block'],
              },
            ],
          },
        ],
      });
      if (findTX) {
        const amount = Utils.dividedByDecimal(findTX.amount, findTX.Currency.decimals);
        const gas_price = findTX.gas_price
          ? Utils.dividedByDecimal(findTX.gas_price, findTX.Currency.decimals)
          : null;
        return new ResponseFormat({
          message: 'Get Transaction Detail',
          payload: {
            txid: findTX.txid,
            status: findTX.result ? 'success' : 'failed',
            confirmations: findTX.Currency.Blockchain.block - findTX.block,
            amount,
            blockchain_id: findTX.Currency.Blockchain.blockchain_id,
            symbol: findTX.Currency.symbol,
            direction: findTX.direction === 0 ? 'send' : 'receive',
            timestamp: findTX.timestamp,
            source_addresses: Utils.formatAddressArray(findTX.source_addresses),
            destination_addresses: Utils.formatAddressArray(findTX.destination_addresses),
            fee: findTX.fee,
            gas_price,
            gas_used: findTX.gas_used,
          },
        });
      }
      return new ResponseFormat({ message: 'txid not found', code: Codes.TX_NOT_FOUND });
    } catch (e) {
      this.logger.error('TransactionDetail e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: `DB Error(${e.message})`, code: Codes.DB_ERROR });
    }
  }

  _formatUTXOType(typeValue) {
    switch (typeValue) {
      case 0:
        return 'legacy';
      case 1:
        return 'segwit';
      case 2:
        return 'native_segwit';
      default:
        return 'legacy';
    }
  }

  async _findAccountUTXO({
    findAccountCurrency, payload, chain_index, key_index,
  }) {
    // find AccountAddress
    const findAccountAddress = await this.accountAddressModel.findOne({ where: { account_id: findAccountCurrency.Account.account_id, chain_index, key_index } });
    if (!findAccountAddress) return new ResponseFormat({ message: 'account not found(address not found)', code: Codes.ACCOUNT_NOT_FOUND });

    // find all UTXO
    const findUTXO = await this.utxoModel.findAll({
      where: { accountAddress_id: findAccountAddress.accountAddress_id, to_tx: { [this.Sequelize.Op.is]: null } },
      include: [
        {
          model: this.accountAddressModel,
          attributes: ['address'],
        },
      ],
    });

    for (let i = 0; i < findUTXO.length; i++) {
      const utxo = findUTXO[i];
      payload.push({
        txid: utxo.txid,
        utxo_id: utxo.utxo_id,
        vout: utxo.vout,
        type: utxo.type,
        amount: utxo.amount,
        script: utxo.script,
        timestamp: utxo.on_block_timestamp,
        chain_index,
        key_index,
        address: utxo.AccountAddress.address,
      });
    }
  }

  async GetUTXO({ params, token }) {
    // account_id -> accountCurrency_id
    const { account_id } = params;

    if (!token) return new ResponseFormat({ message: 'invalid token', code: Codes.INVALID_ACCESS_TOKEN });
    const tokenInfo = await Utils.verifyToken(token);

    try {
      // find Account
      const findAccountCurrency = await this.accountCurrencyModel.findOne({
        where: {
          accountCurrency_id: account_id,
        },
        include: [
          {
            model: this.accountModel,
            where: {
              user_id: tokenInfo.userID,
            },
          },
        ],
      });
      if (!findAccountCurrency) return new ResponseFormat({ message: 'account not found', code: Codes.ACCOUNT_NOT_FOUND });

      const { number_of_external_key, number_of_internal_key } = findAccountCurrency;
      const payload = [];
      // find external address txs
      for (let i = 0; i <= number_of_external_key; i++) {
        // find all address
        await this._findAccountUTXO({
          findAccountCurrency, payload, chain_index: 0, key_index: i,
        });
      }

      // find internal address txs
      for (let i = 0; i <= number_of_internal_key; i++) {
        await this._findAccountUTXO({
          findAccountCurrency, payload, chain_index: 1, key_index: i,
        });
      }

      // sort by timestamps
      payload.sort((a, b) => b.timestamp - a.timestamp);

      return new ResponseFormat({
        message: 'List Unspent Transaction Outputs',
        payload,
      });
    } catch (e) {
      this.logger.error('GetUTXO e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: `DB Error(${e.message})`, code: Codes.DB_ERROR });
    }
  }

  async DROP_ALL_TABLE() {
    await this.sequelize.drop();
  }
}

module.exports = Account;
