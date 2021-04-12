const { v4: uuidv4 } = require('uuid');
const HDWallet = require('./HDWallet');
const ResponseFormat = require('./ResponseFormat');
const Bot = require('./Bot.js');
const Utils = require('./Utils');
const Codes = require('./Codes');
const DBOperator = require('./DBOperator');
const blockchainNetworks = require('./data/blockchainNetworks');

class User extends Bot {
  constructor() {
    super();
    this.name = 'User';
    this.tags = {};
  }

  init({
    config, database, logger, i18n,
  }) {
    return super.init({
      config, database, logger, i18n,
    }).then(() => {
      this.DBOperator = new DBOperator(this.config, this.database, this.logger);
      this.defaultDBInstance = this.database.db[Utils.defaultDBInstanceName];

      this.userModel = this.database.db.User;
      this.blockchainModel = this.database.db.Blockchain;
      this.tokenSecretModel = this.database.db.TokenSecret;
      this.currencyModel = this.database.db.Currency;
      this.accountModel = this.database.db.Account;
      this.accountCurrencyModel = this.database.db.AccountCurrency;
      this.accountAddressModel = this.database.db.AccountAddress;
      this.deviceModel = this.database.db.Device;
      this.sequelize = this.defaultDBInstance.sequelize;
      this.Sequelize = this.defaultDBInstance.Sequelize;
      return this;
    });
  }

  blockchainIDToDBName(blockchainID) {
    const networks = Object.values(blockchainNetworks);
    const findIndex = networks.findIndex((item) => item.blockchain_id === blockchainID);
    if (findIndex === -1) throw new ResponseFormat({ message: 'blockchain id not found', code: Codes.BLOCKCHAIN_ID_NOT_FOUND });
    return networks[findIndex].db_name;
  }

  async UserRegist({ body }) {
    const {
      wallet_name, extend_public_key, install_id, app_uuid,
    } = body;

    if (!Utils.validateString(wallet_name)
    || !Utils.validateString(extend_public_key)
    || !Utils.validateString(install_id)
    || !Utils.validateString(app_uuid)) {
      return new ResponseFormat({ message: 'invalid input', code: Codes.INVALID_INPUT });
    }

    try {
      const findUser = await this.defaultDBInstance.Account.findOne({ where: { extend_public_key } });

      // recover
      if (findUser) {
        // if new app_id, add it
        await this.defaultDBInstance.Device.findOrCreate({
          where: {
            install_id, app_uuid,
          },
          defaults: {
            device_id: uuidv4(),
            user_id: findUser.user_id,
            install_id,
            timestamp: Math.floor(Date.now() / 1000),
            name: '',
            app_uuid,
          },
        });

        const payload = await Utils.generateToken({ userID: findUser.user_id });
        return new ResponseFormat({ message: 'User Regist', payload });
      }

      // new user
      const insertUser = await this.defaultDBInstance.User.create({
        user_id: uuidv4(),
        wallet_name,
        last_login_timestamp: Math.floor(Date.now() / 1000),
      });

      const hdWallet = new HDWallet({ extendPublicKey: extend_public_key });

      const accounts = await this.DBOperator.findAll({
        tableName: 'Currency',
        options: {
          where: { type: 1 },
          include: [
            {
              _model: 'Blockchain',
              attributes: ['blockchain_id', 'block', 'coin_type'],
            },
          ],
        },
      });

      for (let i = 0; i < accounts.length; i++) {
        const DBName = this.blockchainIDToDBName(accounts[i].blockchain_id);
        const _db = this.database.db[DBName];

        const insertAccount = await _db.Account.create({
          account_id: uuidv4(),
          user_id: insertUser.user_id,
          blockchain_id: accounts[i].blockchain_id,
          purpose: 3324,
          curve_type: 0,
          extend_public_key,
          regist_block_num: accounts[i].Blockchain.block,
        });

        await _db.AccountCurrency.create({
          accountCurrency_id: uuidv4(),
          account_id: insertAccount.account_id,
          currency_id: accounts[i].currency_id,
          balance: '0',
          number_of_external_key: '0',
          number_of_internal_key: '0',
        });

        const coinType = accounts[i].Blockchain.coin_type;
        const wallet = hdWallet.getWalletInfo({ coinType, blockchainID: accounts[i].Blockchain.blockchain_id });

        await _db.AccountAddress.create({
          accountAddress_id: uuidv4(),
          account_id: insertAccount.account_id,
          chain_index: 0,
          key_index: 0,
          public_key: wallet.publicKey,
          address: wallet.address,
        });

        if (accounts[i].blockchain_id === '80000000' || accounts[i].blockchain_id === '80000001') {
          const changeWallet = hdWallet.getWalletInfo({ coinType, blockchainID: accounts[i].Blockchain.blockchain_id, change: 1 });
          await _db.AccountAddress.create({
            accountAddress_id: uuidv4(),
            account_id: insertAccount.account_id,
            chain_index: 1,
            key_index: 0,
            public_key: changeWallet.publicKey,
            address: changeWallet.address,
          });
        }
      }
      await this.defaultDBInstance.Device.create({
        device_id: uuidv4(),
        user_id: insertUser.user_id,
        install_id,
        timestamp: Math.floor(Date.now() / 1000),
        name: '',
        app_uuid,
      });

      const payload = await Utils.generateToken({ userID: insertUser.user_id });
      return new ResponseFormat({ message: 'User Regist', payload });
    } catch (e) {
      console.log(e);
      this.logger.error('UserRegist e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: `DB Error(${e.message})`, code: Codes.DB_ERROR });
    }
  }

  async AccessTokenVerify({ query }) {
    const { token } = query;
    if (!token) return new ResponseFormat({ message: 'invalid input', code: Codes.INVALID_INPUT });

    try {
      const data = await Utils.verifyToken(token);

      return new ResponseFormat({
        message: 'Token Verify',
        payload: {
          user_id: data.userID,
          wallet_name: data.user.wallet_name,
        },
      });
    } catch (e) {
      this.logger.error('AccessTokenVerify e:', e);
      if (e.code) return e;
      return e;
    }
  }

  async AccessTokenRenew({ body }) {
    const { token, tokenSecret } = body;
    if (!Utils.validateString(token) || !Utils.validateString(tokenSecret)) {
      return new ResponseFormat({ message: 'invalid input', code: Codes.INVALID_INPUT });
    }
    try {
      const data = await Utils.verifyToken(token, true);
      const findTokenSecret = await this.defaultDBInstance.TokenSecret.findOne({
        where: {
          tokenSecret, user_id: data.userID,
        },
      });

      if (!findTokenSecret) return new ResponseFormat({ message: 'invalid access token secret', code: Codes.INVALID_ACCESS_TOKEN_SECRET });
      if (new Date() > (findTokenSecret.expire_time)) return new ResponseFormat({ message: 'expired access token secret', code: Codes.EXPIRED_ACCESS_TOKEN_SECRET });

      const payload = await this.sequelize.transaction(async (transaction) => {
        const tokenObj = await Utils.generateToken({ userID: data.userID });

        // if generateToken success, delete old tokenSecret
        await this.defaultDBInstance.TokenSecret.destroy({
          where: {
            tokenSecret: findTokenSecret.tokenSecret, user_id: findTokenSecret.user_id,
          },
        }, { transaction });

        return tokenObj;
      });
      return new ResponseFormat({ message: 'Token Renew', payload });
    } catch (e) {
      this.logger.error('AccessTokenRenew e:', e);
      if (e.code) return e;
      throw e;
    }
  }
}

module.exports = User;
