const BigNumber = require('bignumber.js');
const dvalue = require('dvalue'); const { v4: uuidv4 } = require('uuid');
const Web3 = require('web3');
const ecrequest = require('ecrequest');
const { toChecksumAddress } = require('ethereumjs-util');
const EthParser = require('./EthParser');
const EthRopstenParser = require('./EthRopstenParser');
const ResponseFormat = require('./ResponseFormat'); const Bot = require('./Bot.js');
const Codes = require('./Codes');
const Utils = require('./Utils');
const blockchainNetworks = require('./data/blockchainNetworks');
const fiatCurrencyRate = require('./data/fiatCurrencyRate');
const currency = require('./data/currency');

class Blockchain extends Bot {
  constructor() {
    super();
    this.name = 'Blockchain';
    this.tags = {};
  }

  init({
    config, database, logger, i18n,
  }) {
    return super.init({
      config, database, logger, i18n,
    }).then(() => {
      this.accountModel = this.database.db.Account;
      this.blockchainModel = this.database.db.Blockchain;
      this.currencyModel = this.database.db.Currency;
      this.fiatCurrencyRateModel = this.database.db.FiatCurrencyRate;

      this.sequelize = this.database.db.sequelize;
      this.Sequelize = this.database.db.Sequelize;
      return this;
    }).then(async () => {
      await this.initBlockchainNetworks();
      await this.initCurrency();
      await this.initFiatCurrencyRate();
      return this;
    });
  }

  async initBlockchainNetworks() {
    const networks = Object.values(blockchainNetworks);
    for (let i = 0; i < networks.length; i++) {
      const network = { ...networks[i] };
      network.bip32_public = network.bip32.public;
      network.bip32_private = network.bip32.private;
      delete network.bip32;
      await this.blockchainModel.findOrCreate({
        where: { blockchain_id: network.blockchain_id },
        defaults: network,
      });
    }
  }

  async initCurrency() {
    for (let i = 0; i < currency.length; i++) {
      const currencyItem = currency[i];

      await this.currencyModel.findOrCreate({
        where: { currency_id: currencyItem.currency_id },
        defaults: currencyItem,
      });
    }
  }

  async initFiatCurrencyRate() {
    for (let i = 0; i < fiatCurrencyRate.length; i++) {
      const fiatCurrencyRateItem = fiatCurrencyRate[i];

      await this.fiatCurrencyRateModel.findOrCreate({
        where: { currency_id: fiatCurrencyRateItem.currency_id },
        defaults: fiatCurrencyRateItem,
      });
    }
  }

  async BlockchainList() {
    try {
      let payload = await this.blockchainModel.findAll();
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
      const payload = await this.blockchainModel.findOne({
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

  async CurrencyList() {
    try {
      let payload = await this.currencyModel.findAll({
        where: {
          [this.Sequelize.Op.or]: [{ type: 0 }, { type: 1 }],
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
          icon: item.icon,
        }));
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
      const payload = await this.currencyModel.findOne({
        where: {
          currency_id,
          [this.Sequelize.Op.or]: [{ type: 0 }, { type: 1 }],
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

  async TokenList({ params }) {
    const { blockchain_id } = params;
    try {
      let payload = await this.currencyModel.findAll({
        where: { blockchain_id, type: 2 },
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
      const payload = await this.currencyModel.findOne({
        where: {
          currency_id: token_id, type: 2,
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

      const findBlockchainInfo = await this.blockchainModel.findOne({ where: { blockchain_id }, attributes: ['avg_fee'] });
      if (!findBlockchainInfo) return new ResponseFormat({ message: 'blockchain_id not found', code: Codes.BLOCKCHAIN_ID_NOT_FOUND });

      const { avg_fee = '0' } = findBlockchainInfo;

      // avg_fee save unit in db, if avg_fee multiplied 0.8 or 1.5 has decimal point, carry it
      const slowFormat = new BigNumber(avg_fee).multipliedBy(0.8).toFixed(0);
      const standardFormat = new BigNumber(avg_fee).toFixed();
      const fastForMat = new BigNumber(avg_fee).multipliedBy(1.5).toFixed(0);

      let decimals = 8;
      const findBlockchainCurrencyDecimals = await this.currencyModel.findOne({
        where: { blockchain_id, type: 1 },
        attributes: 'decimals',
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
      const findBlockchainInfo = await this.blockchainModel.findOne({ where: { blockchain_id }, attributes: ['avg_fee'] });
      if (!findBlockchainInfo) return new ResponseFormat({ message: 'blockchain_id not found', code: Codes.BLOCKCHAIN_ID_NOT_FOUND });

      const blockchainConfig = Utils.getBlockchainConfig(blockchain_id);
      if (!blockchainConfig) return new ResponseFormat({ message: 'blockchain_id not found', code: Codes.BLOCKCHAIN_ID_NOT_FOUND });

      let gasLimit = '0';
      if (blockchain_id === '8000003C' || blockchain_id === '8000025B') {
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
        // eslint-disable-next-line no-case-declarations
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
      const findUserAddress = await this.accountModel.findOne({
        where: { blockchain_id, user_id: tokenInfo.userID },
      });

      if (!findUserAddress) return new ResponseFormat({ message: 'account not found', code: Codes.ACCOUNT_NOT_FOUND });

      let option = {};
      let nonce = '0';
      // TODO: support another blockchain
      switch (blockchain_id) {
        case '8000003C':
        case '8000025B':
          // eslint-disable-next-line no-case-declarations
          const blockchainConfig = Utils.getBlockchainConfig(blockchain_id);
          if (!blockchainConfig) return new ResponseFormat({ message: 'blockchain_id not found', code: Codes.BLOCKCHAIN_ID_NOT_FOUND });

          option = { ...blockchainConfig };
          option.data = {
            jsonrpc: '2.0',
            method: 'eth_getTransactionCount',
            params: [address, 'latest'],
            id: dvalue.randomID(),
          };
          // eslint-disable-next-line no-case-declarations
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

  async PublishTransaction({ params, body }) {
    const { blockchain_id } = params;
    const { hex } = body;
    if (!hex) return new ResponseFormat({ message: 'invalid input', code: Codes.INVALID_INPUT });

    try {
      let option = {};
      switch (blockchain_id) {
        case '8000003C':
        case '8000025B':
          // eslint-disable-next-line no-case-declarations
          const blockchainConfig = Utils.getBlockchainConfig(blockchain_id);
          if (!blockchainConfig) return new ResponseFormat({ message: 'blockchain_id not found', code: Codes.BLOCKCHAIN_ID_NOT_FOUND });

          option = { ...blockchainConfig };
          option.data = {
            jsonrpc: '2.0',
            method: 'eth_sendRawTransaction',
            params: [hex],
            id: dvalue.randomID(),
          };
          // eslint-disable-next-line no-case-declarations
          const data = await Utils.ETHRPC(option);

          if (!data.result && data === false) return new ResponseFormat({ message: 'rpc error(blockchain down)', code: Codes.RPC_ERROR });
          if (!data.result) return new ResponseFormat({ message: `rpc error(${data.error.message})`, code: Codes.RPC_ERROR });

          return new ResponseFormat({
            message: 'Publish Transaction',
            payload: {
              txid: data.result,
            },
          });

        default:
          return new ResponseFormat({
            message: 'Publish Transaction',
            payload: {},
          });
      }
    } catch (e) {
      this.logger.error('PublishTransaction e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: 'DB Error', code: Codes.DB_ERROR });
    }
  }

  async FiatsRate() {
    try {
      const findRates = await this.fiatCurrencyRateModel.findAll({
        include: [
          {
            model: this.currencyModel,
            attributes: ['symbol'],
          },
        ],
      });
      const payload = [];
      findRates.forEach((item) => {
        payload.push({ name: item.Currency.symbol, rate: item.rate || '0' });
      });
      return new ResponseFormat({ message: 'List Fiat Currency Rate', payload });
    } catch (e) {
      this.logger.error('FiatsRate e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: 'DB Error', code: Codes.DB_ERROR });
    }
  }

  async CryptoRate() {
    try {
      const findRates = await this.currencyModel.findAll({
        attributes: ['exchange_rate', 'symbol'],
        where: {
          [this.Sequelize.Op.or]: [{ type: 1 }, { type: 2 }],
        },
      });
      const payload = [];
      findRates.forEach((item) => {
        payload.push({
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
      // use contract check Token is exist
      const findTokenItem = await this.currencyModel.findOne({
        where: { type: 2, contract, blockchain_id },
      });

      if (findTokenItem) {
        return new ResponseFormat({
          message: 'Get Token Info',
          payload: {
            symbol: findTokenItem.symbol,
            name: findTokenItem.name,
            contract: findTokenItem.contract,
            decimal: findTokenItem.decimal,
            total_supply: findTokenItem.total_supply,
            description: findTokenItem.description,
            imageUrl: findTokenItem.icon || `${this.config.base.domain}/icon/ERC20.png`,
          },
        });
      }

      // if not found token in DB, parse token contract info from blockchain
      let ParserClass = '';
      switch (blockchain_id) {
        case '8000003C':
          ParserClass = EthParser;
          break;
        case '8000025B':
          ParserClass = EthRopstenParser;
          break;
        default:
          return new ResponseFormat({ message: 'blockchain has not token', code: Codes.BLOCKCHAIN_HAS_NOT_TOKEN });
      }
      const _parserInstance = new ParserClass(this.config, this.database, this.logger);
      _parserInstance.web3 = new Web3();
      const tokenInfoFromPeer = await Promise.all([
        _parserInstance.getTokenNameFromPeer(contract),
        _parserInstance.getTokenSymbolFromPeer(contract),
        _parserInstance.getTokenDecimalFromPeer(contract),
        _parserInstance.getTokenTotalSupplyFromPeer(contract),
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
      await this.currencyModel.create({
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
}

module.exports = Blockchain;
