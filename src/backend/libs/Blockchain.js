/* eslint-disable no-case-declarations */
const BigNumber = require('bignumber.js');
const dvalue = require('dvalue');
const { v4: uuidv4 } = require('uuid');
const ecrequest = require('ecrequest');
// ++ remove after extract to instance class
const BtcParserBase = require('./BtcParserBase');
const BchParserBase = require('./BchParserBase');
const ResponseFormat = require('./ResponseFormat');
const Bot = require('./Bot.js');
const Codes = require('./Codes');
const Utils = require('./Utils');
const blockchainNetworks = require('./data/blockchainNetworks');
const fiatCurrencyRate = require('./data/fiatCurrencyRate');
const currency = require('./data/currency');
const tokenList = require('./data/tokenList');
const DBOperator = require('./DBOperator');
const HDWallet = require('./HDWallet');

class Blockchain extends Bot {
  constructor() {
    super();
    this.name = 'Blockchain';
    this.tags = {};
    this.cacheBlockchainInfo = {};
    this.updateBalanceAccounts = {};
    this.tideWalletTokenList = [];
  }

  init({
    config, database, logger, i18n,
  }) {
    return super.init({
      config, database, logger, i18n,
    }).then(() => {
      this.DBOperator = new DBOperator(this.config, this.database, this.logger);
      this.defaultDBInstance = this.database.db[Utils.defaultDBInstanceName];

      this.sequelize = this.defaultDBInstance.sequelize;
      this.Sequelize = this.defaultDBInstance.Sequelize;
      return this;
    }).then(async () => {
      await this.initBlockchainNetworks();
      await this.initCurrency();
      await this.initFiatCurrencyRate();
      await this.initTokenList();
      if (!this.isCrawler()) { await this.initBackendHDWallet(); }
      return this;
    });
  }

  async initBackendHDWallet() {
    if (!this.config.base.extendPublicKey) return Promise.reject(new Error('base.extendPublicKey config not set'));
    try {
      const botUser = await this.getBot('User');
      await botUser.UserRegist({
        body: {
          wallet_name: 'TideWallet-Backend',
          extend_public_key: this.config.base.extendPublicKey,
          install_id: 'TideWallet-Backend',
          app_uuid: 'TideWallet-Backend',
        },
      });
    } catch (e) {
      console.log(e); // -- no console.log
      return Promise.reject(new Error(`Create HDWallet Error: ${e}`));
    }
  }

  async initBlockchainNetworks() {
    const networks = Object.keys(blockchainNetworks);
    for (const networkName of networks) {
      const network = { ...blockchainNetworks[networkName] };
      network.bip32_public = network.bip32.public;
      network.bip32_private = network.bip32.private;
      delete network.bip32;
      delete network.db_name;
      await this.database.db[networkName].Blockchain.findOrCreate({
        where: { blockchain_id: network.blockchain_id },
        defaults: network,
      });
    }
  }

  async initCurrency() {
    const networks = Object.keys(currency);
    for (const networkName of networks) {
      for (let i = 0; i < currency[networkName].length; i++) {
        const currencyItem = currency[networkName][i];

        await this.database.db[networkName].Currency.findOrCreate({
          where: { currency_id: currencyItem.currency_id },
          defaults: currencyItem,
        });
      }
    }
  }

  async initFiatCurrencyRate() {
    for (let i = 0; i < fiatCurrencyRate.length; i++) {
      const fiatCurrencyRateItem = fiatCurrencyRate[i];

      await this.defaultDBInstance.FiatCurrencyRate.findOrCreate({
        where: { currency_id: fiatCurrencyRateItem.currency_id },
        defaults: fiatCurrencyRateItem,
      });
    }
  }

  async initTokenList() {
    for (const dbName of Object.keys(tokenList)) {
      for (const tokenItem of tokenList[dbName]) {
        const findCurrency = await this.database.db[dbName].Currency.findOne({ where: { contract: tokenItem.contract } });
        if (findCurrency) {
          if ((findCurrency.name !== tokenItem.name) || (findCurrency.symbol !== tokenItem.symbol)) {
            await this.database.db[dbName].Currency.update({
              name: tokenItem.name,
              symbol: tokenItem.symbol,
            }, {
              where: { contract: tokenItem.contract },
            });
          }
          this.tideWalletTokenList.push({
            currency_id: findCurrency.currency_id,
            name: findCurrency.name,
            symbol: findCurrency.symbol,
            type: findCurrency.type,
            publish: findCurrency.publish,
            decimals: findCurrency.decimals,
            exchange_rate: findCurrency.exchange_rate,
            icon: findCurrency.icon || `${this.config.base.domain}/icon/ERC20.png`,
            contract: findCurrency.contract,
          });
        }
      }
    }
  }

  async BlockchainList() {
    try {
      let payload = await this.DBOperator.findAll({ tableName: 'Blockchain' });
      if (payload) {
        payload = payload.map((item) => ({
          blockchain_id: item.blockchain_id,
          name: item.name,
          coin_type: item.coin_type,
          network_id: item.network_id,
          publish: item.publish,
        }));
      }
      return new ResponseFormat({ message: 'List Supported Blockchains', payload });
    } catch (e) {
      this.logger.error('BlockchainList e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: 'DB Error', code: Codes.DB_ERROR });
    }
  }

  async BlockchainDetail({ params }) {
    const { blockchain_id } = params;
    try {
      const findChainNetworkIndex = Object.values(blockchainNetworks).findIndex((item) => item.blockchain_id === blockchain_id);
      if (findChainNetworkIndex === -1) return new ResponseFormat({ message: 'blockchain_id Not Found', code: Codes.BLOCKCHAIN_ID_NOT_FOUND });
      const tableName = Object.keys(blockchainNetworks)[findChainNetworkIndex];

      const payload = await this.database.db[tableName].Blockchain.findOne({
        where: { blockchain_id },
      });

      if (!payload) return new ResponseFormat({ message: 'blockchain_id Not Found', code: Codes.BLOCKCHAIN_ID_NOT_FOUND });
      return new ResponseFormat({ message: 'Get Blockchain Detail', payload });
    } catch (e) {
      this.logger.error('BlockchainDetail e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: 'DB Error', code: Codes.DB_ERROR });
    }
  }

  async _findFiatCurrencyRate(currency_id) {
    return this.defaultDBInstance.FiatCurrencyRate.findOne({
      where: { currency_id },
      attributes: ['rate'],
    });
  }

  async CurrencyList() {
    try {
      const findCurrency = await this.DBOperator.findAll({
        tableName: 'Currency',
        options: {
          where: {
            [this.Sequelize.Op.or]: [{ type: 0 }, { type: 1 }],
          },
        },
      });
      const payload = [];
      if (findCurrency) {
        for (const item of findCurrency) {
          let { exchange_rate } = item;
          if (exchange_rate === null) {
            const findRate = await this._findFiatCurrencyRate(item.currency_id);
            if (findRate)exchange_rate = findRate.rate;
          }
          payload.push({
            currency_id: item.currency_id,
            name: item.name,
            symbol: item.symbol,
            type: item.type,
            publish: item.publish,
            decimals: item.decimals,
            exchange_rate,
            icon: item.icon,
          });
        }
      }
      return new ResponseFormat({ message: 'List Supported Currencies', payload });
    } catch (e) {
      this.logger.error('CurrencyList e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: 'DB Error', code: Codes.DB_ERROR });
    }
  }

  async CurrencyDetail({ params }) {
    const { currency_id } = params;
    try {
      const payload = await this.DBOperator.findOne({
        tableName: 'Currency',
        options: {
          where: {
            currency_id,
            [this.Sequelize.Op.or]: [{ type: 0 }, { type: 1 }],
          },
        },
      });

      if (!payload) return new ResponseFormat({ message: 'currency_id Not Found', code: Codes.CURRENCY_ID_NOT_FOUND });
      return new ResponseFormat({ message: 'Get Currency Detail', payload });
    } catch (e) {
      this.logger.error('CurrencyDetail e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: 'DB Error', code: Codes.DB_ERROR });
    }
  }

  async TokenList({ params, query }) {
    const { blockchain_id } = params;
    const { type } = query;

    if (type && type === 'TideWallet') return new ResponseFormat({ message: 'List Supported Currencies', payload: this.tideWalletTokenList });
    try {
      let payload = await this.DBOperator.findAll({
        tableName: 'Currency',
        options: {
          where: { blockchain_id, type: 2 },
        },
      });
      if (payload) {
        payload = payload.map((item) => ({
          currency_id: item.currency_id,
          name: item.name,
          symbol: item.symbol,
          type: item.type,
          publish: item.publish,
          decimals: item.decimals,
          exchange_rate: item.exchange_rate,
          icon: item.icon || `${this.config.base.domain}/icon/ERC20.png`,
          contract: item.contract,
        }));
      } else {
        payload = [];
      }
      return new ResponseFormat({ message: 'List Supported Currencies', payload });
    } catch (e) {
      this.logger.error('TokenList e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: 'DB Error', code: Codes.DB_ERROR });
    }
  }

  async TokenDetail({ params }) {
    const { blockchain_id, token_id } = params;
    try {
      const payload = await this.DBOperator.findOne({
        tableName: 'Currency',
        options: {
          where: {
            currency_id: token_id, type: 2,
          },
        },
      });

      if (!payload) return new ResponseFormat({ message: 'currency_id Not Found', code: Codes.CURRENCY_ID_NOT_FOUND });
      if (payload.blockchain_id !== blockchain_id) return new ResponseFormat({ message: 'currency_id Not Found', code: Codes.CURRENCY_ID_NOT_FOUND });
      return new ResponseFormat({ message: 'Get Currency Detail', payload });
    } catch (e) {
      this.logger.error('TokenDetail e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: 'DB Error', code: Codes.DB_ERROR });
    }
  }

  async GetFee({ params }) {
    try {
      const { blockchain_id } = params;

      const findBlockchainInfo = await this.DBOperator.findOne({
        tableName: 'Blockchain',
        options: {
          where: { blockchain_id },
          attributes: ['avg_fee'],
        },
      });
      if (!findBlockchainInfo) return new ResponseFormat({ message: 'blockchain_id not found', code: Codes.BLOCKCHAIN_ID_NOT_FOUND });

      const { avg_fee = '0' } = findBlockchainInfo;

      // avg_fee save unit in db, if avg_fee multiplied 0.8 or 1.5 has decimal point, carry it
      const slowFormat = new BigNumber(avg_fee).multipliedBy(0.8).toFixed(0);
      const standardFormat = new BigNumber(avg_fee).toFixed();
      const fastForMat = new BigNumber(avg_fee).multipliedBy(1.5).toFixed(0);

      let decimals = 8;

      const findBlockchainCurrencyDecimals = await this.DBOperator.findOne({
        tableName: 'Currency',
        options: {
          where: { blockchain_id, type: 1 },
          attributes: ['decimals'],
        },
      });
      if (findBlockchainCurrencyDecimals) decimals = findBlockchainCurrencyDecimals.decimals;

      return new ResponseFormat({
        message: 'Get Currency Detail',
        payload: {
          slow: Utils.dividedByDecimal(slowFormat, decimals),
          standard: Utils.dividedByDecimal(standardFormat, decimals),
          fast: Utils.dividedByDecimal(fastForMat, decimals),
        },
      });
    } catch (e) {
      this.logger.error('GetFee e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: 'DB Error', code: Codes.DB_ERROR });
    }
  }

  async GetGasLimit({ params, body }) {
    const { blockchain_id } = params;
    const {
      fromAddress, toAddress, value, data: signatureData,
    } = body;

    if (!Utils.validateString(fromAddress)
    || !Utils.validateString(toAddress)
    || !Utils.validateString(value)
    || !Utils.validateString(signatureData)) return new ResponseFormat({ message: 'invalid input', code: Codes.INVALID_INPUT });

    try {
      const findBlockchainInfo = await this.DBOperator.findOne({
        tableName: 'Blockchain',
        options: {
          where: { blockchain_id },
          attributes: ['avg_fee'],
        },
      });
      if (!findBlockchainInfo) return new ResponseFormat({ message: 'blockchain_id not found', code: Codes.BLOCKCHAIN_ID_NOT_FOUND });

      const blockchainConfig = Utils.getBlockchainConfig(blockchain_id);
      if (!blockchainConfig) return new ResponseFormat({ message: 'blockchain_id not found', code: Codes.BLOCKCHAIN_ID_NOT_FOUND });

      let gasLimit = '0';
      if (blockchain_id === '8000003C' || blockchain_id === 'F000003C' || blockchain_id === '80000CFC' || blockchain_id === '80001F51') {
        const option = { ...blockchainConfig };
        option.data = {
          jsonrpc: '2.0',
          method: 'eth_estimateGas',
          params: [{
            from: fromAddress,
            nonce: value,
            to: toAddress,
            data: signatureData,
          }],
          id: dvalue.randomID(),
        };
        const data = await Utils.ETHRPC(option);
        if (!data.result && data === false) return new ResponseFormat({ message: 'rpc error(blockchain down)', code: Codes.RPC_ERROR });
        if (!data.result) return new ResponseFormat({ message: `rpc error(${data.error.message})`, code: Codes.RPC_ERROR });
        gasLimit = new BigNumber(data.result).toFixed();
        return new ResponseFormat({
          message: 'Get Gas Limit',
          payload: {
            gasLimit,
          },
        });
      }
      return new ResponseFormat({
        message: 'Get Gas Limit',
        payload: {
          gasLimit,
        },
      });
    } catch (e) {
      this.logger.error('GetGasLimit e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: 'DB Error', code: Codes.DB_ERROR });
    }
  }

  async GetNonce({ params, token }) {
    const { blockchain_id, address } = params;

    if (!token) return new ResponseFormat({ message: 'invalid token', code: Codes.INVALID_ACCESS_TOKEN });
    const tokenInfo = await Utils.verifyToken(token);

    try {
      // find user, address mapping
      const findUserAddress = await this.DBOperator.findOne({
        tableName: 'AccountAddress',
        options: {
          where: { address },
          include: [
            {
              _model: 'Account',
              where: { blockchain_id, user_id: tokenInfo.userID },
              attributes: ['account_id'],
            },
          ],
        },
      });

      if (!findUserAddress) return new ResponseFormat({ message: 'account not found', code: Codes.ACCOUNT_NOT_FOUND });

      let option = {};
      let nonce = '0';
      // TODO: support another blockchain
      switch (blockchain_id) {
        case '8000003C':
        case 'F000003C':
        case '80000CFC':
        case '80001F51':
          const blockchainConfig = Utils.getBlockchainConfig(blockchain_id);
          if (!blockchainConfig) return new ResponseFormat({ message: 'blockchain_id not found', code: Codes.BLOCKCHAIN_ID_NOT_FOUND });

          option = { ...blockchainConfig };
          option.data = {
            jsonrpc: '2.0',
            method: 'eth_getTransactionCount',
            params: [address, 'latest'],
            id: dvalue.randomID(),
          };
          const data = await Utils.ETHRPC(option);

          if (!data.result && data === false) return new ResponseFormat({ message: 'rpc error(blockchain down)', code: Codes.RPC_ERROR });
          if (!data.result) return new ResponseFormat({ message: `rpc error(${data.error.message})`, code: Codes.RPC_ERROR });
          nonce = new BigNumber(data.result).toFixed();

          return new ResponseFormat({
            message: 'Get Nonce',
            payload: { nonce },
          });

        default:
          return new ResponseFormat({
            message: 'Get Nonce',
            payload: { nonce },
          });
      }
    } catch (e) {
      this.logger.error('GetNonce e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: 'DB Error', code: Codes.DB_ERROR });
    }
  }

  async GetNonceByAddress({ params }) {
    const { blockchain_id, address } = params;
    try {
      let option = {};
      let nonce = '0';
      // TODO: support another blockchain
      switch (blockchain_id) {
        case '8000003C':
        case 'F000003C':
        case '80000CFC':
        case '80001F51':
          const blockchainConfig = Utils.getBlockchainConfig(blockchain_id);
          if (!blockchainConfig) return new ResponseFormat({ message: 'blockchain_id not found', code: Codes.BLOCKCHAIN_ID_NOT_FOUND });

          option = { ...blockchainConfig };
          option.data = {
            jsonrpc: '2.0',
            method: 'eth_getTransactionCount',
            params: [address, 'latest'],
            id: dvalue.randomID(),
          };
          const data = await Utils.ETHRPC(option);

          if (!data.result && data === false) return new ResponseFormat({ message: 'rpc error(blockchain down)', code: Codes.RPC_ERROR });
          if (!data.result) return new ResponseFormat({ message: `rpc error(${data.error.message})`, code: Codes.RPC_ERROR });
          nonce = new BigNumber(data.result).toFixed();

          return new ResponseFormat({
            message: 'Get Nonce',
            payload: { nonce },
          });

        default:
          return new ResponseFormat({
            message: 'Get Nonce',
            payload: { nonce },
          });
      }
    } catch (e) {
      this.logger.error('GetNonce e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: 'DB Error', code: Codes.DB_ERROR });
    }
  }

  async saveBTCPublishTransaction(tx, currencyInfo, timestamp, retryCount = 0) {
    if (retryCount > 3) {
      this.logger.error('saveBTCPublishTransaction retry error');
      this.logger.error('saveBTCPublishTransaction tx', JSON.stringify(tx));
      this.logger.error('saveBTCPublishTransaction currencyInfo', JSON.stringify(currencyInfo.toJSON()));
      return;
    }
    try {
      // ++ change after extract to instance class
      const DBName = Utils.blockchainIDToDBName(this.bcid);
      const _db = this.database.db[DBName];
      const that = { ...this };
      that.transactionModel = _db.Transaction;
      that.accountAddressModel = _db.AccountAddress;
      that.accountModel = _db.Account;
      that.blockchainModel = _db.Blockchain;
      that.utxoModel = _db.UTXO;
      that.addressTransactionModel = _db.AddressTransaction;
      that.accountCurrencyModel = _db.AccountCurrency;
      that.sequelize = _db.sequelize;
      that.Sequelize = _db.Sequelize;

      await BtcParserBase.parseTx.call(that, tx, currencyInfo, timestamp);
    } catch (error) {
      this.logger.error('saveBTCPublishTransaction retry error:', error.message);
      setTimeout(() => {
        this.saveBTCPublishTransaction(tx, currencyInfo, timestamp, retryCount += 1);
      }, 300);
    }
  }

  async saveBCHPublishTransaction(tx, currencyInfo, timestamp, retryCount = 0) {
    if (retryCount > 3) {
      this.logger.error('saveBCHPublishTransaction retry error');
      this.logger.error('saveBCHPublishTransaction tx', JSON.stringify(tx));
      this.logger.error('saveBCHPublishTransaction currencyInfo', JSON.stringify(currencyInfo.toJSON()));
      return;
    }
    try {
      // ++ change after extract to instance class
      const DBName = Utils.blockchainIDToDBName(this.bcid);
      const _db = this.database.db[DBName];
      const that = { ...this };
      that.transactionModel = _db.Transaction;
      that.accountAddressModel = _db.AccountAddress;
      that.accountModel = _db.Account;
      that.blockchainModel = _db.Blockchain;
      that.utxoModel = _db.UTXO;
      that.addressTransactionModel = _db.AddressTransaction;
      that.accountCurrencyModel = _db.AccountCurrency;
      that.sequelize = _db.sequelize;
      that.Sequelize = _db.Sequelize;

      await BchParserBase.parseTx.call(that, tx, currencyInfo, timestamp);
    } catch (error) {
      this.logger.error('saveBCHPublishTransaction retry error:', error.message);
      setTimeout(() => {
        this.saveBCHPublishTransaction(tx, currencyInfo, timestamp, retryCount += 1);
      }, 300);
    }
  }


  async PublishTransaction({ params, body }) {
    const { blockchain_id } = params;
    const { hex } = body;
    if (!hex) return new ResponseFormat({ message: 'invalid input', code: Codes.INVALID_INPUT });

    try {
      let option = {};
      let data = {};
      const blockchainConfig = Utils.getBlockchainConfig(blockchain_id);
      if (!blockchainConfig) return new ResponseFormat({ message: 'blockchain_id not found', code: Codes.BLOCKCHAIN_ID_NOT_FOUND });
      switch (blockchain_id) {
        case '8000003C':
        case 'F000003C':
        case '80000CFC':
        case '80001F51':
          option = { ...blockchainConfig };
          option.data = {
            jsonrpc: '2.0',
            method: 'eth_sendRawTransaction',
            params: [hex],
            id: dvalue.randomID(),
          };
          data = await Utils.ETHRPC(option);

          if (!data.result && data === false) return new ResponseFormat({ message: 'rpc error(blockchain down)', code: Codes.RPC_ERROR });
          if (!data.result) return new ResponseFormat({ message: `rpc error(${data.error.message})`, code: Codes.RPC_ERROR });

          return new ResponseFormat({
            message: 'Publish Transaction',
            payload: {
              txid: data.result,
            },
          });

        case '80000000':
        case 'F0000000':
          option = { ...blockchainConfig };
          let txid = '';
          // send transaction
          option.data = {
            jsonrpc: '2.0',
            method: 'sendrawtransaction',
            params: [hex],
            id: dvalue.randomID(),
          };
          data = await Utils.BTCRPC(option);
          if (!data.result && data === false) return new ResponseFormat({ message: 'rpc error(blockchain down)', code: Codes.RPC_ERROR });
          if (!data.result) return new ResponseFormat({ message: `rpc error(${data.error.message})`, code: Codes.RPC_ERROR });
          txid = data.result;

          // if send success, insert transaction & pending utxo to db
          option.data = {
            jsonrpc: '2.0',
            method: 'decoderawtransaction',
            params: [hex],
            id: dvalue.randomID(),
          };
          data = await Utils.BTCRPC(option);
          if (!data.result && data === false) return new ResponseFormat({ message: 'rpc error(blockchain down)', code: Codes.RPC_ERROR });
          if (!data.result) return new ResponseFormat({ message: `rpc error(${data.error.message})`, code: Codes.RPC_ERROR });

          const DBName = Utils.blockchainIDToDBName(blockchain_id);
          const _db = this.database.db[DBName];
          const findCurrency = await _db.Currency.findOne({
            where: {
              blockchain_id,
              type: 1,
            },
            attributes: ['currency_id', 'decimals', 'blockchain_id', 'decimals'],
            include: [
              {
                model: _db.Blockchain,
                attributes: ['block'],
              },
            ],
          });

          this.bcid = blockchain_id;
          this.decimal = findCurrency.decimals;
          const _data = { ...data.result, height: findCurrency.Blockchain.block };

          await this.saveBTCPublishTransaction(_data, findCurrency, Math.floor(Date.now() / 1000), 0);

          return new ResponseFormat({
            message: 'Publish Transaction',
            payload: { txid },
          });

        case '80000091':
        case 'F0000091': // ++ TODO change bch testnet blocId by Emily 2021.05.24
          option = { ...blockchainConfig };
          let txid = '';
          // send transaction
          option.data = {
            jsonrpc: '1.0',
            method: 'sendrawtransaction',
            params: [hex],
            id: dvalue.randomID(),
          };
          data = await Utils.BCHRPC(option);
          if (!data.result && data === false) return new ResponseFormat({ message: 'rpc error(blockchain down)', code: Codes.RPC_ERROR });
          if (!data.result) return new ResponseFormat({ message: `rpc error(${data.error.message})`, code: Codes.RPC_ERROR });
          txid = data.result;

          // if send success, insert transaction & pending utxo to db
          option.data = {
            jsonrpc: '1.0',
            method: 'decoderawtransaction',
            params: [hex],
            id: dvalue.randomID(),
          };
          data = await Utils.BCHRPC(option);
          if (!data.result && data === false) return new ResponseFormat({ message: 'rpc error(blockchain down)', code: Codes.RPC_ERROR });
          if (!data.result) return new ResponseFormat({ message: `rpc error(${data.error.message})`, code: Codes.RPC_ERROR });

          const DBName = Utils.blockchainIDToDBName(blockchain_id);
          const _db = this.database.db[DBName];
          const findCurrency = await _db.Currency.findOne({
            where: {
              blockchain_id,
              type: 1,
            },
            attributes: ['currency_id', 'decimals', 'blockchain_id', 'decimals'],
            include: [
              {
                model: _db.Blockchain,
                attributes: ['block'],
              },
            ],
          });

          this.bcid = blockchain_id;
          this.decimal = findCurrency.decimals;
          const _data = { ...data.result, height: findCurrency.Blockchain.block };

          await this.saveBCHPublishTransaction(_data, findCurrency, Math.floor(Date.now() / 1000), 0);

          return new ResponseFormat({
            message: 'Publish Transaction',
            payload: { txid },
          });
        default:
          return new ResponseFormat({ message: 'blockchain not support', code: Codes.BLOCKCHAIN_NOT_SUPPORT });
      }
    } catch (e) {
      this.logger.error('PublishTransaction e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: 'DB Error', code: Codes.DB_ERROR });
    }
  }

  async FiatsRate() {
    try {
      const findRates = await this.defaultDBInstance.FiatCurrencyRate.findAll({
        include: [
          {
            model: this.defaultDBInstance.Currency,
            attributes: ['currency_id', 'symbol'],
          },
        ],
      });
      const payload = [];
      findRates.forEach((item) => {
        payload.push({
          currency_id: item.currency_id,
          name: item.Currency.symbol,
          rate: item.rate || '0',
        });
      });
      return new ResponseFormat({ message: 'List Fiat Currency Rate', payload });
    } catch (e) {
      if (e.code) return e;
      return new ResponseFormat({ message: 'DB Error', code: Codes.DB_ERROR });
    }
  }

  async CryptoRate() {
    try {
      const findRates = await this.DBOperator.findAll({
        tableName: 'Currency',
        options: {
          attributes: ['currency_id', 'exchange_rate', 'symbol'],
          where: {
            [this.Sequelize.Op.or]: [{ type: 1 }, { type: 2 }],
            exchange_rate: { [this.Sequelize.Op.not]: null },
          },
        },
      });
      const payload = [];
      findRates.forEach((item) => {
        payload.push({
          currency_id: item.currency_id,
          name: item.symbol,
          rate: item.exchange_rate || '0',
        });
      });
      return new ResponseFormat({ message: 'List Crypto Currency Rate', payload });
    } catch (e) {
      this.logger.error('CryptoRate e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: 'DB Error', code: Codes.DB_ERROR });
    }
  }

  async TokenInfo({ params }) {
    try {
      const { contract, blockchain_id } = params;
      const DBName = Utils.blockchainIDToDBName(blockchain_id);
      const _db = this.database.db[DBName];
      // use contract check Token is exist
      const findTokenItem = await _db.Currency.findOne({
        where: { type: 2, contract, blockchain_id },
      });

      if (findTokenItem) {
        return new ResponseFormat({
          message: 'Get Token Info',
          payload: {
            symbol: findTokenItem.symbol,
            name: findTokenItem.name,
            contract: findTokenItem.contract,
            decimals: findTokenItem.decimals,
            total_supply: findTokenItem.total_supply,
            description: findTokenItem.description,
            imageUrl: findTokenItem.icon || `${this.config.base.domain}/icon/ERC20.png`,
          },
        });
      }

      // if not found token in DB, parse token contract info from blockchain
      let options = '';
      switch (blockchain_id) {
        case '8000003C':
          options = this.config.blockchain.ethereum_mainnet;
          break;
        case 'F000003C':
          options = this.config.blockchain.ethereum_ropsten;
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

      const newCurrencyID = uuidv4();
      if (!Array.isArray(tokenInfoFromPeer) || !tokenInfoFromPeer[0] || !tokenInfoFromPeer[1] || !(tokenInfoFromPeer[2] >= 0) || !tokenInfoFromPeer[3]) return new ResponseFormat({ message: 'contract not found', code: Codes.CONTRACT_CONT_FOUND });
      this.logger.debug('tokenInfoFromPeer:', tokenInfoFromPeer);
      let total_supply = tokenInfoFromPeer[3];
      try {
        total_supply = new BigNumber(tokenInfoFromPeer[3]).dividedBy(new BigNumber(10 ** tokenInfoFromPeer[2])).toFixed({
          groupSeparator: ',', groupSize: 3,
        });
      // eslint-disable-next-line no-empty
      } catch (e) {
      }
      await _db.Currency.create({
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

      return new ResponseFormat({
        message: 'Get Token Info',
        payload: {
          symbol: tokenInfoFromPeer[1],
          name: tokenInfoFromPeer[0],
          contract,
          decimal: tokenInfoFromPeer[2],
          total_supply,
          description: '',
          imageUrl: icon,
        },
      });
    } catch (e) {
      this.logger.error('TokenInfo e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: 'DB Error', code: Codes.DB_ERROR });
    }
  }

  async ethBlockHeight(blockchain_id) {
    const blockchainConfig = Utils.getBlockchainConfig(blockchain_id);
    const option = { ...blockchainConfig };

    option.data = {
      jsonrpc: '2.0',
      method: 'eth_blockNumber',
      params: [],
      id: dvalue.randomID(),
    };
    const data = await Utils.ETHRPC(option);
    if (!data.result && data === false) return new ResponseFormat({ message: 'rpc error(blockchain down)', code: Codes.RPC_ERROR });
    if (!data.result) return new ResponseFormat({ message: `rpc error(${data.error.message})`, code: Codes.RPC_ERROR });
    return new BigNumber(data.result).toNumber();
  }

  async btcBlockHeight(blockchain_id) {
    const blockchainConfig = Utils.getBlockchainConfig(blockchain_id);
    const option = { ...blockchainConfig };

    option.data = {
      jsonrpc: '1.0',
      method: 'getblockcount',
      params: [],
      id: dvalue.randomID(),
    };

    const data = await Utils.BTCRPC(option);
    if (!data.result && data === false) return new ResponseFormat({ message: 'rpc error(blockchain down)', code: Codes.RPC_ERROR });
    if (!data.result) return new ResponseFormat({ message: `rpc error(${data.error.message})`, code: Codes.RPC_ERROR });
    return new BigNumber(data.result).toNumber();
  }

  async bchBlockHeight(blockchain_id) {
    const blockchainConfig = Utils.getBlockchainConfig(blockchain_id);
    const option = { ...blockchainConfig };

    option.data = {
      jsonrpc: '1.0',
      method: 'getblockcount',
      params: [],
      id: dvalue.randomID(),
    };

    const data = await Utils.BCHRPC(option);
    if (!data.result && data === false) return new ResponseFormat({ message: 'rpc error(blockchain down)', code: Codes.RPC_ERROR });
    if (!data.result) return new ResponseFormat({ message: `rpc error(${data.error.message})`, code: Codes.RPC_ERROR });
    return new BigNumber(data.result).toNumber();
  }

  async findBlockScannedHeight(blockchain_id) {
    const DBName = Utils.blockchainIDToDBName(blockchain_id);
    const _db = this.database.db[DBName];
    const findBtcMainnetUnparsedTxTimestamp = await _db.UnparsedTransaction.findOne({
      where: { blockchain_id, retry: 0 },
      order: [['timestamp', 'ASC']],
      attributes: ['timestamp'],
    });

    let result = {};
    if (findBtcMainnetUnparsedTxTimestamp) {
      result = await _db.BlockScanned.findOne({
        where: { blockchain_id, timestamp: findBtcMainnetUnparsedTxTimestamp.timestamp },
      });
      if (result) return result.block;
    }
    result = await _db.BlockScanned.findOne({
      where: { blockchain_id },
      order: [['timestamp', 'DESC']],
    });
    if (result) return result.block;
    return 0;
  }

  async BlockHeight() {
    try {
      const now = Math.floor(Date.now() / 1000);
      if (this.cacheBlockchainInfo && (now - this.cacheBlockchainInfo.timestamp) < 30) return new ResponseFormat({ message: 'Block Height', payload: this.cacheBlockchainInfo.data });
      const findBlockchain = await this.DBOperator.findAll({ tableName: 'Blockchain' });

      const BlockHeightsFromPeer = await Promise.all([
        this.btcBlockHeight('80000000'),
        this.btcBlockHeight('F0000000'),
        this.bchBlockHeight('80000091'),
        this.bchBlockHeight('F0000091'), // ++ TODO change bch testnet blocId by Emily 2021.05.24
        this.ethBlockHeight('8000003C'),
        this.ethBlockHeight('F000003C'),
        this.ethBlockHeight('80001F51'),
      ]).catch((error) => new ResponseFormat({ message: `rpc error(${error})`, code: Codes.RPC_ERROR }));
      if (BlockHeightsFromPeer.code === Codes.RPC_ERROR) return BlockHeightsFromPeer;
      const [btcMainnetBlockHeight, btcTestnetBlockHeight,bchMainnetBlockHeight, bchTestnetBlockHeight, ethMainnetBlockHeight, ethTestnetBlockHeight, ttnBlockHeight] = BlockHeightsFromPeer;

      const _dbBtcMainnetBlockHeight = findBlockchain.find((item) => item.blockchain_id === '80000000');
      const dbBtcMainnetBlockHeight = _dbBtcMainnetBlockHeight ? _dbBtcMainnetBlockHeight.block : 0;
      const _dbBtcTestnetBlockHeight = findBlockchain.find((item) => item.blockchain_id === 'F0000000');
      const dbBtcTestnetBlockHeight = _dbBtcTestnetBlockHeight ? _dbBtcTestnetBlockHeight.block : 0;
      const _dbBchMainnetBlockHeight = findBlockchain.find((item) => item.blockchain_id === '80000091');
      const dbBchMainnetBlockHeight = _dbBchMainnetBlockHeight ? _dbBchMainnetBlockHeight.block : 0;
      const _dbBchTestnetBlockHeight = findBlockchain.find((item) => item.blockchain_id === 'F0000091'); // ++ TODO change bch testnet blocId by Emily 2021.05.24
      const dbBchTestnetBlockHeight = _dbBchTestnetBlockHeight ? _dbBchTestnetBlockHeight.block : 0;
      const _dbEthMainnetBlockHeight = findBlockchain.find((item) => item.blockchain_id === '8000003C');
      const dbEthMainnetBlockHeight = _dbEthMainnetBlockHeight ? _dbEthMainnetBlockHeight.block : 0;
      const _dbEthTestnetBlockHeight = findBlockchain.find((item) => item.blockchain_id === 'F000003C');
      const dbEthTestnetBlockHeight = _dbEthTestnetBlockHeight ? _dbEthTestnetBlockHeight.block : 0;
      const _dbTTNBlockHeight = findBlockchain.find((item) => item.blockchain_id === '80001F51');
      const dbTTNBlockHeight = _dbTTNBlockHeight ? _dbTTNBlockHeight.block : 0;

      const btcMainnetBlockScannedBlockHeight = await this.findBlockScannedHeight('80000000');
      const btcTestnetBlockScannedBlockHeight = await this.findBlockScannedHeight('F0000000');
      const bchMainnetBlockScannedBlockHeight = await this.findBlockScannedHeight('80000091');
      const bchTestnetBlockScannedBlockHeight = await this.findBlockScannedHeight('F0000091'); // ++ TODO change bch testnet blocId by Emily 2021.05.24
      const ethMainnetBlockScannedBlockHeight = await this.findBlockScannedHeight('8000003C');
      const ethTestnetBlockScannedBlockHeight = await this.findBlockScannedHeight('F000003C');
      const ttnBlockScannedBlockHeight = await this.findBlockScannedHeight('80001F51');

      this.cacheBlockchainInfo = {
        timestamp: Math.floor(Date.now() / 1000),
        data: {
          BTC_MAINNET: {
            blockHeight: btcMainnetBlockHeight,
            db_blockHeight: dbBtcMainnetBlockHeight,
            blockScanned_blockHeight: btcMainnetBlockScannedBlockHeight,
            unCrawlerBlock: btcMainnetBlockHeight - dbBtcMainnetBlockHeight,
            unParseBlock: btcMainnetBlockHeight - btcMainnetBlockScannedBlockHeight,
          },
          BTC_TESTNET: {
            blockHeight: btcTestnetBlockHeight,
            db_blockHeight: dbBtcTestnetBlockHeight,
            blockScanned_blockHeight: btcTestnetBlockScannedBlockHeight,
            unCrawlerBlock: btcTestnetBlockHeight - dbBtcTestnetBlockHeight,
            unParseBlock: btcTestnetBlockHeight - btcTestnetBlockScannedBlockHeight,
          },
          BCH_MAINNET: {
            blockHeight: bchMainnetBlockHeight,
            db_blockHeight: dbBchMainnetBlockHeight,
            blockScanned_blockHeight: bchMainnetBlockScannedBlockHeight,
            unCrawlerBlock: bchMainnetBlockHeight - dbBchMainnetBlockHeight,
            unParseBlock: bchMainnetBlockHeight - bchMainnetBlockScannedBlockHeight,
          },
          BCH_TESTNET: {
            blockHeight: bchTestnetBlockHeight,
            db_blockHeight: dbBchTestnetBlockHeight,
            blockScanned_blockHeight: bchTestnetBlockScannedBlockHeight,
            unCrawlerBlock: bchTestnetBlockHeight - dbBchTestnetBlockHeight,
            unParseBlock: bchTestnetBlockHeight - bchTestnetBlockScannedBlockHeight,
          },
          ETH_MAINNET: {
            blockHeight: ethMainnetBlockHeight,
            db_blockHeight: dbEthMainnetBlockHeight,
            blockScanned_blockHeight: ethMainnetBlockScannedBlockHeight,
            unCrawlerBlock: ethMainnetBlockHeight - dbEthMainnetBlockHeight,
            unParseBlock: ethMainnetBlockHeight - ethMainnetBlockScannedBlockHeight,
          },
          ETH_TESTNET: {
            blockHeight: ethTestnetBlockHeight,
            db_blockHeight: dbEthTestnetBlockHeight,
            blockScanned_blockHeight: ethTestnetBlockScannedBlockHeight,
            unCrawlerBlock: ethTestnetBlockHeight - dbEthTestnetBlockHeight,
            unParseBlock: ethTestnetBlockHeight - ethTestnetBlockScannedBlockHeight,
          },
          TTN: {
            blockHeight: ttnBlockHeight,
            db_blockHeight: dbTTNBlockHeight,
            blockScanned_blockHeight: ttnBlockScannedBlockHeight,
            unCrawlerBlock: ttnBlockHeight - dbTTNBlockHeight,
            unParseBlock: ttnBlockHeight - ttnBlockScannedBlockHeight,
          },
        },
      };

      return new ResponseFormat({ message: 'Block Height', payload: this.cacheBlockchainInfo.data });
    } catch (e) {
      console.log(e); // -- no console.log
      this.logger.error('BlockHeight error:', JSON.stringify(e));
      return new ResponseFormat({ code: Codes.UNKNOWN_ERROR, message: e.message });
    }
  }

  async BlockHeightMetrics() {
    const data = await this.BlockHeight();
    if (!data && !data.payload) return data;

    return `BTC_MAINNET_BLOCKHEIGHT ${data.payload.BTC_MAINNET.blockHeight}
BTC_MAINNET_DB_BLOCKHEIGHT ${data.payload.BTC_MAINNET.db_blockHeight}
BTC_MAINNET_BLOCKSCANNED_BLOCKHEIGHT ${data.payload.BTC_MAINNET.blockScanned_blockHeight}
BTC_MAINNET_UNCRAWLERBLOCK ${data.payload.BTC_MAINNET.unCrawlerBlock}
BTC_MAINNET_UNPARSEBLOCK ${data.payload.BTC_MAINNET.unParseBlock}

BTC_TESTNET_BLOCKHEIGHT ${data.payload.BTC_TESTNET.blockHeight}
BTC_TESTNET_DB_BLOCKHEIGHT ${data.payload.BTC_TESTNET.db_blockHeight}
BTC_TESTNET_BLOCKSCANNED_BLOCKHEIGHT ${data.payload.BTC_TESTNET.blockScanned_blockHeight}
BTC_TESTNET_UNCRAWLERBLOCK ${data.payload.BTC_TESTNET.unCrawlerBlock}
BTC_TESTNET_UNPARSEBLOCK ${data.payload.BTC_TESTNET.unParseBlock}

BCH_MAINNET_BLOCKHEIGHT ${data.payload.BCH_MAINNET.blockHeight}
BCH_MAINNET_DB_BLOCKHEIGHT ${data.payload.BCH_MAINNET.db_blockHeight}
BCH_MAINNET_BLOCKSCANNED_BLOCKHEIGHT ${data.payload.BCH_MAINNET.blockScanned_blockHeight}
BCH_MAINNET_UNCRAWLERBLOCK ${data.payload.BCH_MAINNET.unCrawlerBlock}
BCH_MAINNET_UNPARSEBLOCK ${data.payload.BCH_MAINNET.unParseBlock}

BCH_TESTNET_BLOCKHEIGHT ${data.payload.BCH_TESTNET.blockHeight}
BCH_TESTNET_DB_BLOCKHEIGHT ${data.payload.BCH_TESTNET.db_blockHeight}
BCH_TESTNET_BLOCKSCANNED_BLOCKHEIGHT ${data.payload.BCH_TESTNET.blockScanned_blockHeight}
BCH_TESTNET_UNCRAWLERBLOCK ${data.payload.BCH_TESTNET.unCrawlerBlock}
BCH_TESTNET_UNPARSEBLOCK ${data.payload.BCH_TESTNET.unParseBlock}

ETH_MAINNET_BLOCKHEIGHT ${data.payload.ETH_MAINNET.blockHeight}
ETH_MAINNET_DB_BLOCKHEIGHT ${data.payload.ETH_MAINNET.db_blockHeight}
ETH_MAINNET_BLOCKSCANNED_BLOCKHEIGHT ${data.payload.ETH_MAINNET.blockScanned_blockHeight}
ETH_MAINNET_UNCRAWLERBLOCK ${data.payload.ETH_MAINNET.unCrawlerBlock}
ETH_MAINNET_UNPARSEBLOCK ${data.payload.ETH_MAINNET.unParseBlock}

ETH_TESTNET_BLOCKHEIGHT ${data.payload.ETH_TESTNET.blockHeight}
ETH_TESTNET_DB_BLOCKHEIGHT ${data.payload.ETH_TESTNET.db_blockHeight}
ETH_TESTNET_BLOCKSCANNED_BLOCKHEIGHT ${data.payload.ETH_TESTNET.blockScanned_blockHeight}
ETH_TESTNET_UNCRAWLERBLOCK ${data.payload.ETH_TESTNET.unCrawlerBlock}
ETH_TESTNET_UNPARSEBLOCK ${data.payload.ETH_TESTNET.unParseBlock}

TTN_BLOCKHEIGHT ${data.payload.TTN.blockHeight}
TTN_DB_BLOCKHEIGHT ${data.payload.TTN.db_blockHeight}
TTN_BLOCKSCANNED_BLOCKHEIGHT ${data.payload.TTN.blockScanned_blockHeight}
TTN_UNCRAWLERBLOCK ${data.payload.TTN.unCrawlerBlock}
TTN_UNPARSEBLOCK ${data.payload.TTN.unParseBlock}
`;
  }

  async ServerWallets() {
    try {
      const findAccount = await this.accountModel.findAll({
        where: { extend_public_key: this.config.base.extendPublicKey },
        attributes: ['account_id', 'blockchain_id'],
      });

      if (!findAccount || findAccount.length === 0) return new ResponseFormat({ message: 'account not found', code: Codes.ACCOUNT_NOT_FOUND });

      const payload = [];
      for (let i = 0; i < findAccount.length; i++) {
        const accountItem = findAccount[i];
        const findAddress = await this.accountAddressModel.findAll({
          where: { account_id: accountItem.account_id },
          attributes: ['address'],
        });
        if (findAddress || findAddress.length > 0) {
          for (let j = 0; j < findAddress.length; j++) {
            const addressItem = findAddress[j];

            let _balance = '0';
            switch (accountItem.blockchain_id) {
              case '8000003C':
              case 'F000003C':
              case '80001F51':
                _balance = await Utils.ethGetBalanceByAddress(accountItem.blockchain_id, addressItem.address, 18);
                break;
                case '80000000':
                case 'F0000000':
                case '80000091':
                case 'F0000091':
                // eslint-disable-next-line no-case-declarations
                const findAccountCurrency = await this.accountCurrencyModel.findOne({
                  where: { account_id: accountItem.account_id },
                });
                if (findAccountCurrency && findAccountCurrency.balance) _balance = findAccountCurrency.balance;
                break;
              default:
                break;
            }
            const blockchainInfo = Object.values(blockchainNetworks).find((item) => item.blockchain_id === accountItem.blockchain_id);
            payload.push({
              blockchainId: accountItem.blockchain_id,
              name: blockchainInfo.name,
              address: addressItem.address,
              balance: _balance,
            });
          }
        }
      }

      return new ResponseFormat({ message: 'Explore Address Detail', payload });
    } catch (e) {
      console.log(e); // -- no console.log
      this.logger.error('NodeInfo e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: `DB Error(${e.message})`, code: Codes.DB_ERROR });
    }
  }

  isCrawler() {
    // ++ may change after db separate
    const blockchains = Object.keys(this.config.blockchain);
    let result = false;
    for (const blockchain of blockchains) {
      if (this.config.syncSwitch[blockchain]) {
        result = true;
        break;
      }
    }
    return result;
  }
}

module.exports = Blockchain;
