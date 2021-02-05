const { v4: uuidv4 } = require('uuid');
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
      this.currencyModel = this.database.db.Currency;
      this.accountModel = this.database.db.Account;
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
      const userID = await this.sequelize.transaction(async (transaction) => {
        const insertUser = await this.userModel.create({
          User_id: uuidv4(),
          wallet_name,
          last_login_timestamp: Math.floor(Date.now() / 1000),
        }, { transaction });

        const accounts = await this.currencyModel.findAll({
          where: { type: 1 },
          include: [
            {
              model: this.blockchainModel,
              attributes: ['block'],
            },
          ],
        });
        for (let i = 0; i < accounts.length; i++) {
          await this.accountModel.create({
            Account_id: uuidv4(),
            User_id: insertUser.User_id,
            Blockchain_id: accounts[i].Blockchain_id,
            purpose: 44,
            curve_type: 0,
            extend_public_key,
            regist_block_num: accounts[i].Blockchain.block,
          }, { transaction });
        }

        return insertUser.User_id;
      });

      const payload = await Utils.generateToken({ userID });
      return new ResponseFormat({ message: 'User Regist', payload });
    } catch (error) {
      return new ResponseFormat({ message: 'DB Error', code: Codes.DB_ERROR });
    }
  }

  async AccessTokenVerify({ query }) {
    const { token } = query;
    if (!token) return new ResponseFormat({ message: 'invalid input', code: Codes.INVALID_INPUT });

    try {
      const data = await Utils.verifyToken(token);

      return new ResponseFormat({
        message: 'User Regist',
        payload: {
          user_id: data.userID,
          wallet_name: data.user.wallet_name,
        },
      });
    } catch (e) {
      return e;
    }
  }
}

module.exports = User;
