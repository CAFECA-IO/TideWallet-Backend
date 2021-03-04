const { v4: uuidv4 } = require('uuid');
const HDWallet = require('./HDWallet');
const ResponseFormat = require('./ResponseFormat');
const Bot = require('./Bot.js');
const Utils = require('./Utils');
const Codes = require('./Codes');

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
      this.userModel = this.database.db.User;
      this.blockchainModel = this.database.db.Blockchain;
      this.tokenSecretModel = this.database.db.TokenSecret;
      this.currencyModel = this.database.db.Currency;
      this.accountModel = this.database.db.Account;
      this.accountCurrencyModel = this.database.db.AccountCurrency;
      this.accountAddressModel = this.database.db.AccountAddress;
      this.deviceModel = this.database.db.Device;
      this.sequelize = this.database.db.sequelize;
      this.Sequelize = this.database.db.Sequelize;
      return this;
    });
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
      const findUser = await this.accountModel.findOne({ where: { extend_public_key } });

      // recover
      if (findUser) {
        // if new app_id, add it
        await this.deviceModel.findOrCreate({
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
      const userID = await this.sequelize.transaction(async (transaction) => {
        const insertUser = await this.userModel.create({
          user_id: uuidv4(),
          wallet_name,
          last_login_timestamp: Math.floor(Date.now() / 1000),
        }, { transaction });

        const hdWallet = new HDWallet({ extendPublicKey: extend_public_key });

        const accounts = await this.currencyModel.findAll({
          where: { type: 1 },
          include: [
            {
              model: this.blockchainModel,
              attributes: ['blockchain_id', 'block', 'coin_type'],
            },
          ],
        });
        for (let i = 0; i < accounts.length; i++) {
          const insertAccount = await this.accountModel.create({
            account_id: uuidv4(),
            user_id: insertUser.user_id,
            blockchain_id: accounts[i].blockchain_id,
            purpose: 3324,
            curve_type: 0,
            extend_public_key,
            regist_block_num: accounts[i].Blockchain.block,
          }, { transaction });

          await this.accountCurrencyModel.create({
            accountCurrency_id: uuidv4(),
            account_id: insertAccount.account_id,
            currency_id: accounts[i].currency_id,
            balance: '0',
            number_of_external_key: '0',
            number_of_internal_key: '0',
          }, { transaction });

          const coinType = accounts[i].Blockchain.coin_type;
          const wallet = hdWallet.getWalletInfo({ coinType, blockchainID: accounts[i].Blockchain.blockchain_id });

          await this.accountAddressModel.create({
            accountAddress_id: uuidv4(),
            account_id: insertAccount.account_id,
            chain_index: 0,
            key_index: 0,
            public_key: wallet.publicKey,
            address: wallet.address,
          }, { transaction });

          if (accounts[i].blockchain_id === '80000000' || accounts[i].blockchain_id === '80000001') {
            const changeWallet = hdWallet.getWalletInfo({ coinType, blockchainID: accounts[i].Blockchain.blockchain_id, chang: 1 });
            await this.accountAddressModel.create({
              accountAddress_id: uuidv4(),
              account_id: insertAccount.account_id,
              chain_index: 1,
              key_index: 0,
              public_key: changeWallet.publicKey,
              address: changeWallet.address,
            }, { transaction });
          }
        }
        await this.deviceModel.create({
          device_id: uuidv4(),
          user_id: insertUser.user_id,
          install_id,
          timestamp: Math.floor(Date.now() / 1000),
          name: '',
          app_uuid,
        }, { transaction });

        return insertUser.user_id;
      });

      const payload = await Utils.generateToken({ userID });
      return new ResponseFormat({ message: 'User Regist', payload });
    } catch (e) {
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
      const findTokenSecret = await this.tokenSecretModel.findOne({
        where: {
          tokenSecret, user_id: data.userID,
        },
      });

      if (!findTokenSecret) return new ResponseFormat({ message: 'invalid access token secret', code: Codes.INVALID_ACCESS_TOKEN_SECRET });
      if (new Date() > (findTokenSecret.expire_time)) return new ResponseFormat({ message: 'expired access token secret', code: Codes.EXPIRED_ACCESS_TOKEN_SECRET });

      const payload = await this.sequelize.transaction(async (transaction) => {
        const tokenObj = await Utils.generateToken({ userID: data.userID });

        // if generateToken success, delete old tokenSecret
        await this.tokenSecretModel.destroy({
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
