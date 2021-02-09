const { v4: uuidv4 } = require('uuid');
const ResponseFormat = require('./ResponseFormat');
const Bot = require('./Bot.js');
const Utils = require('./Utils');
const Codes = require('./Codes');

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
      this.deviceModel = this.database.db.Device;

      this.sequelize = this.database.db.sequelize;
      this.Sequelize = this.database.db.Sequelize;
      return this;
    });
  }

  async TokenRegist({ params, token }) {
    try {
      const { blockchain_id, currency_id } = params;

      if (!Utils.validateString(blockchain_id) || !Utils.validateString(currency_id)) {
        return new ResponseFormat({ message: 'invalid input', code: Codes.INVALID_INPUT });
      }

      if (!token) return new ResponseFormat({ message: 'invalid token', code: Codes.INVALID_ACCESS_TOKEN });
      const tokenInfo = await Utils.verifyToken(token);

      // find Token is exist
      const findTokenItem = await this.currencyModel.findOne({
        where: { type: 2, Currency_id: currency_id },
      });

      if (findTokenItem) {
        // check token x blockchain mapping
        if (findTokenItem.Blockchain_id !== blockchain_id) return new ResponseFormat({ message: 'blockchain has not token', code: Codes.BLOCKCHAIN_HAS_NOT_TOKEN });

        // check account token is exist
        const findUserAccountData = await this.accountModel.findOne({
          where: {
            User_id: tokenInfo.userID, Blockchain_id: blockchain_id,
          },
        });
        if (!findUserAccountData) return new ResponseFormat({ message: 'account not found', code: Codes.ACCOUNT_NOT_FOUND });

        const findUserAccountToken = await this.accountCurrencyModel.findOne({
          where: {
            Account_id: findUserAccountData.Account_id, Currency_id: currency_id,
          },
        });
        if (findUserAccountToken) return new ResponseFormat({ message: 'account token exist', code: Codes.ACCOUNT_TOKEN_EXIST });

        // create token data to db
        try {
          const payload = await this.sequelize.transaction(async (transaction) => {
            const token_account_id = uuidv4();
            await this.accountCurrencyModel.create({
              AccountCurrency_id: uuidv4(),
              Account_id: findUserAccountData.Account_id,
              Currency_id: currency_id,
              balance: '0',
              number_of_external_key: '0',
              number_of_internal_key: '0',
            }, { transaction });

            // find token public_key & address
            const findAccountAddress = await this.accountAddressModel.findOne({
              where: { Account_id: findUserAccountData.Account_id },
              transaction,
            });

            await this.accountAddressModel.create({
              AccountAddress_id: uuidv4(),
              Account_id: findUserAccountData.Account_id,
              chain_index: 0,
              key_index: 0,
              public_key: findAccountAddress.public_key,
              address: findAccountAddress.address,
            }, { transaction });

            return { token_account_id };
          });

          return new ResponseFormat({ message: 'Account Token Regist', payload });
        } catch (e) {
          console.log(e);
          return new ResponseFormat({ message: `DB Error(${e.message})`, code: Codes.DB_ERROR });
        }
      }

      // TODO: if not found token in DB, parse token contract info from blockchain
      return new ResponseFormat({ message: 'Account Token Regist', payload: {} });
    } catch (e) {
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
          User_id: tokenInfo.userID,
        },
      });

      for (let i = 0; i < findAccounts.length; i++) {
        const account = findAccounts[i];
        const findAccountCurrencies = await this.accountCurrencyModel.findAll({
          where: {
            Account_id: account.Account_id,
          },
          include: [
            {
              model: this.currencyModel,
              attributes: ['type'],
              where: {
                type: 1,
              },
            },
          ],
        });
        for (let j = 0; j < findAccountCurrencies.length; j++) {
          const accountCurrency = findAccountCurrencies[j];
          payload.push({
            account_id: account.Account_id,
            blockchain_id: account.Blockchain_id,
            currency_id: accountCurrency.Currency_id,
            balance: accountCurrency.balance,
            account_index: '0',
          });
        }
      }
      return new ResponseFormat({ message: 'Get Account List', payload });
    } catch (e) {
      console.log(e);
      if (e.code) return e;
      return new ResponseFormat({ message: `DB Error(${e.message})`, code: Codes.DB_ERROR });
    }
  }

  async AccountDetail({ token, params }) {
    if (!token) return new ResponseFormat({ message: 'invalid token', code: Codes.INVALID_ACCESS_TOKEN });
    const tokenInfo = await Utils.verifyToken(token);

    const { currency_id } = params;
    if (!Utils.validateString(currency_id)) return new ResponseFormat({ message: 'invalid input', code: Codes.INVALID_INPUT });
    const payload = [];
    const accountObj = {};

    try {
      const findAccounts = await this.accountModel.findAll({
        where: {
          User_id: tokenInfo.userID,
        },
      });

      for (let i = 0; i < findAccounts.length; i++) {
        const account = findAccounts[i];
        const findAccountCurrencies = await this.accountCurrencyModel.findAll({
          where: {
            Account_id: account.Account_id,
          },
          include: [
            {
              model: this.currencyModel,
              attributes: ['Currency_id', 'name', 'symbol', 'type', 'publish', 'decimals', 'total_supply', 'contract', 'icon'],
              where: {
                [this.Sequelize.Op.or]: [{ type: 1 }, { type: 2 }],
              },
            },
          ],
        });
        for (let j = 0; j < findAccountCurrencies.length; j++) {
          const accountCurrency = findAccountCurrencies[j];
          if (accountCurrency.Currency && accountCurrency.Currency.type === 1) {
            payload.push({
              blockchain_id: account.Blockchain_id,
              currency_id: accountCurrency.Currency_id,
              account_id: account.Account_id,
              purpose: account.purpose,
              account_index: '0',
              curve_type: account.curve_type,
              number_of_external_key: account.number_of_external_key,
              number_of_internal_key: account.number_of_internal_key,
              balance: accountCurrency.balance,
              symbol: accountCurrency.Currency.symbol,
              icon: accountCurrency.Currency.icon,
            });
          } else if (accountCurrency.Currency && accountCurrency.Currency.type === 2) {
            if (!accountObj[account.Account_id])accountObj[account.Account_id] = [];
            accountObj[account.Account_id].push({
              token_id: accountCurrency.Currency.Currency_id,
              blockchain_id: account.Blockchain_id,
              name: accountCurrency.Currency.name,
              symbol: accountCurrency.Currency.symbol,
              type: accountCurrency.Currency.type,
              publish: accountCurrency.Currency.publish,
              decimals: accountCurrency.Currency.decimals,
              total_supply: accountCurrency.Currency.total_supply,
              contract: accountCurrency.Currency.contract,
              balance: accountCurrency.balance,
            });
          }
        }
      }
      payload.forEach((item) => {
        item.tokens = accountObj[item.account_id] || [];
      });
      return new ResponseFormat({ message: 'Get Account List', payload });
    } catch (e) {
      console.log(e);
      if (e.code) return e;
      return new ResponseFormat({ message: `DB Error(${e.message})`, code: Codes.DB_ERROR });
    }
  }
}

module.exports = Account;
