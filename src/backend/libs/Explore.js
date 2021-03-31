const Bot = require('./Bot');
const Utils = require('./Utils');
const ResponseFormat = require('./ResponseFormat');
const Codes = require('./Codes');

class Explore extends Bot {
  constructor() {
    super();
    this.name = 'Explore';

    // catch cold data
    this.blockchainName = {};
  }

  init({
    config, database, logger, i18n,
  }) {
    return super.init({
      config, database, logger, i18n,
    }).then(() => {
      this.accountModel = this.database.db.Account;
      this.accountCurrencyModel = this.database.db.AccountCurrency;
      this.accountAddressModel = this.database.db.AccountAddress;
      this.blockchainModel = this.database.db.Blockchain;
      this.blockScannedModel = this.database.db.BlockScanned;
      this.addressTransactionModel = this.database.db.AddressTransaction;
      this.transactionModel = this.database.db.Transaction;
      this.addressTokenTransactionModel = this.database.db.AddressTokenTransaction;
      this.tokenTransactionModel = this.database.db.TokenTransaction;
      this.currencyModel = this.database.db.Currency;

      this.sequelize = this.database.db.sequelize;
      this.Sequelize = this.database.db.Sequelize;
      return this;
    });
  }

  async blockchainIdToName(blockchain_id) {
    if (this.blockchainName[blockchain_id]) return this.blockchainName[blockchain_id];
    const findOne = await this.blockchainModel.findOne({
      where: { blockchain_id },
      attributes: ['name'],
    });
    if (!findOne) return '';

    this.blockchainName[blockchain_id] = findOne.name;
    return findOne.name;
  }

  async TransactionDetail({ params }) {
    try {
      const { txid } = params;
      const payload = [];

      const findTx = await this.transactionModel.findOne({
        where: { txid },
        include: [
          {
            model: this.currencyModel,
            attributes: ['blockchain_id', 'name', 'icon', 'symbol', 'decimals'],
          },
        ],
      });
      if (!findTx) return new ResponseFormat({ message: 'transaction not found', code: Codes.TX_NOT_FOUND });

      payload.push({
        blockchainId: findTx.Currency.blockchain_id,
        iconUrl: findTx.Currency.icon,
        txHash: findTx.txid,
        symbol: findTx.Currency.symbol,
        block: findTx.block,
        timestamp: findTx.timestamp,
        from: findTx.source_addresses,
        to: findTx.destination_addresses,
        value: Utils.dividedByDecimal(findTx.amount, findTx.Currency.decimals),
        fee: Utils.dividedByDecimal(findTx.fee, findTx.Currency.decimals),
      });

      // find token transaction table
      const findTokenTx = await this.tokenTransactionModel.findAll({
        where: { txid },
        include: [
          {
            model: this.currencyModel,
            attributes: ['blockchain_id', 'name', 'icon', 'symbol', 'decimals'],
          },
        ],
      });
      if (findTokenTx) {
        findTokenTx.forEach((txItem) => {
          payload.push({
            blockchainId: txItem.Currency.blockchain_id,
            iconUrl: txItem.Currency.icon,
            txHash: txItem.txid,
            symbol: txItem.Currency.symbol,
            block: txItem.block,
            timestamp: txItem.timestamp,
            from: txItem.source_addresses,
            to: txItem.destination_addresses,
            value: Utils.dividedByDecimal(txItem.amount, txItem.Currency.decimals),
            fee: Utils.dividedByDecimal(txItem.fee, txItem.Currency.decimals),
          });
        });
      }

      return new ResponseFormat({ message: 'Explore Transaction Detail', payload });
    } catch (e) {
      this.logger.error('TransactionDetail e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: `DB Error(${e.message})`, code: Codes.DB_ERROR });
    }
  }

  async TransactionList({ query }) {
    try {
      const { index = 0, limit = 20 } = query;

      const { QueryTypes } = this.sequelize;
      const findTransactionList = await this.sequelize.query(
        `SELECT
            t1.*,
            "Currency"."blockchain_id" AS "currency_blockchain_id",
            "Currency"."name" AS "currency_name",
            "Currency"."icon" AS "currency_icon",
            "Currency"."symbol" AS "currency_symbol",
            "Currency"."decimals" AS "currency_decimals"
          FROM (
            (SELECT
              "transaction_id",
              "currency_id",
              "txid",
              "timestamp",
              "source_addresses",
              "destination_addresses",
              "amount",
              "block",
              "fee"
            FROM
              "Transaction"
            ORDER BY
              "transaction_id" DESC
            LIMIT :limit OFFSET :index)
            UNION
            (SELECT
              "transaction_id",
              "currency_id",
              "txid",
              "timestamp",
              "source_addresses",
              "destination_addresses",
              "amount",
              NULL AS "block",
              NULL AS "fee"
            FROM
              "TokenTransaction"
            ORDER BY
              "transaction_id" DESC
            LIMIT :limit OFFSET :index)
            ) AS t1
            LEFT OUTER JOIN "Currency" AS "Currency" ON "t1"."currency_id" = "Currency"."currency_id"
          ORDER BY
            "transaction_id" DESC`,
        {

          replacements: {
            index: Number(index),
            limit: Math.floor(Number(limit) + 1),
          },
          type: QueryTypes.SELECT,
        },
      );

      const items = [];
      const findAllAmount = await this.transactionModel.count() + await this.tokenTransactionModel.count();
      const meta = {
        hasNext: false,
        nextIndex: 0,
        count: findAllAmount || 0,
      };
      let breakFlag = false;
      for (let i = 0; i < findTransactionList.length && !breakFlag; i++) {
        const txItem = findTransactionList[i];
        if (i < limit) {
          items.push({
            blockchainId: txItem.currency_blockchain_id,
            iconUrl: txItem.currency_icon,
            txHash: txItem.txid,
            symbol: txItem.currency_symbol,
            block: txItem.block,
            timestamp: txItem.timestamp,
            from: txItem.source_addresses,
            to: txItem.destination_addresses,
            value: Utils.dividedByDecimal(txItem.amount, txItem.currency_decimals),
            fee: Utils.dividedByDecimal(txItem.fee, txItem.currency_decimals),
          });
        } else {
          console.log('breakFlag');
          breakFlag = true;
          meta.hasNext = true;
          meta.nextIndex = Number(index) + Number(limit);
        }
      }

      return new ResponseFormat({ message: 'Explore Transaction List', items, meta });
    } catch (e) {
      this.logger.error('TransactionList e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: `DB Error(${e.message})`, code: Codes.DB_ERROR });
    }
  }

  async BlockList({ query }) {
    try {
      const { index = 0, limit = 20 } = query;
      const findBlocks = await this.blockScannedModel.findAll({
        offset: Number(index),
        limit: Number(limit) + 1,
        attributes: ['blockchain_id', 'block', 'block_hash', 'timestamp', 'result'],
        order: [['timestamp', 'DESC']],
      });
      const items = [];

      for (const item of findBlocks) {
        const itemJSON = JSON.parse(item.result);

        // eslint-disable-next-line no-nested-ternary
        const txCount = (itemJSON.nTx !== undefined) ? itemJSON.nTx : (itemJSON.transactions) ? itemJSON.transactions.length : 0;
        items.push({
          blockchainId: item.blockchain_id,
          name: await this.blockchainIdToName(item.blockchain_id),
          blockHeight: item.block,
          blockHash: item.block_hash,
          timestamp: item.timestamp,
          txCount,
        });
      }
      const findAllAmount = await this.blockScannedModel.count();

      const meta = {
        hasNext: false,
        nextIndex: 0,
        count: findAllAmount || 0,
      };
      if (items.length > Number(limit)) {
        items.pop();
        meta.hasNext = true;
        meta.nextIndex = Number(index) + Number(limit);
      }
      return new ResponseFormat({ message: 'Explore Block List', items, meta });
    } catch (e) {
      this.logger.error('BlockList e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: `DB Error(${e.message})`, code: Codes.DB_ERROR });
    }
  }

  async BlockDetail({ params }) {
    try {
      const { blockchain_id, block_id } = params;

      const findBlockInfo = await this.blockScannedModel.findOne({
        where: { blockchain_id, block_hash: block_id },
        attributes: ['blockchain_id', 'block', 'timestamp', 'result'],
      });
      if (!findBlockInfo) return new ResponseFormat({ message: 'block not found', code: Codes.BLOCK_NOT_FOUND });

      const itemJSON = JSON.parse(findBlockInfo.result);

      // eslint-disable-next-line no-nested-ternary
      const txCount = (itemJSON.nTx !== undefined) ? itemJSON.nTx : (itemJSON.transactions) ? itemJSON.transactions.length : 0;

      const payload = {
        name: await this.blockchainIdToName(findBlockInfo.blockchain_id),
        blockHeight: findBlockInfo.block,
        timestamp: findBlockInfo.timestamp,
        txCount,
      };
      return new ResponseFormat({ message: 'Explore Block Detail', payload });
    } catch (e) {
      this.logger.error('BlockDetail e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: `DB Error(${e.message})`, code: Codes.DB_ERROR });
    }
  }

  async BlockTransactions({ params, query }) {
    try {
      const { blockchain_id, block_id } = params;
      const { index = 0, limit = 20 } = query;

      const findBlockInfo = await this.blockScannedModel.findOne({
        where: { blockchain_id, block_hash: block_id },
        attributes: ['block', 'timestamp', 'result'],
      });
      if (!findBlockInfo) return new ResponseFormat({ message: 'block not found', code: Codes.BLOCK_NOT_FOUND });

      const itemJSON = JSON.parse(findBlockInfo.result);

      // eslint-disable-next-line no-nested-ternary
      const txCount = (itemJSON.nTx !== undefined) ? itemJSON.nTx : (itemJSON.transactions) ? itemJSON.transactions.length : 0;
      // eslint-disable-next-line no-nested-ternary
      const txs = (itemJSON.tx !== undefined) ? itemJSON.tx : (itemJSON.transactions) ? itemJSON.transactions : [];

      const items = [];
      const endIndex = Number(index) + Number(limit) + 1;
      const loopEndIndex = Math.min(txs.length, endIndex);
      for (let i = index; i < loopEndIndex; i++) {
        const txItem = txs[i];
        const txid = (txItem.txid) ? txItem.txid : txItem.hash;
        const findTx = await this.transactionModel.findOne({
          where: { txid },
          attributes: ['transaction_id', 'currency_id', 'txid', 'timestamp', 'source_addresses', 'destination_addresses', 'amount', 'block', 'fee'],
          include: [
            {
              model: this.currencyModel,
              attributes: ['blockchain_id', 'name', 'icon', 'symbol', 'decimals'],
            },
          ],
        });
        if (findTx) {
          items.push({
            blockchainId: findTx.Currency.blockchain_id,
            iconUrl: findTx.Currency.icon,
            txHash: findTx.txid,
            symbol: findTx.Currency.symbol,
            block: findTx.block,
            timestamp: findTx.timestamp,
            from: findTx.source_addresses,
            to: findTx.destination_addresses,
            value: Utils.dividedByDecimal(findTx.amount, findTx.Currency.decimals),
            fee: Utils.dividedByDecimal(findTx.fee, findTx.Currency.decimals),
          });
        }
      }

      const meta = {
        hasNext: false,
        nextIndex: 0,
        count: txCount || 0,
      };
      if (items.length > Number(limit)) {
        items.pop();
        meta.hasNext = true;
        meta.nextIndex = Number(index) + Number(limit);
      }
      return new ResponseFormat({ message: 'Explore Block Detail', items, meta });
    } catch (e) {
      this.logger.error('BlockDetail e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: `DB Error(${e.message})`, code: Codes.DB_ERROR });
    }
  }

  async NodeInfo({ query }) {
    try {
      const { index = 0, limit = 20 } = query;
      const findBlockchain = await this.blockchainModel.findAll({
        attributes: ['blockchain_id', 'name', 'block', 'avg_fee'],
      });

      // TODO: use db data to calculator
      // calculator tps
      const tpsItems = [];
      for (let i = 0; i < findBlockchain.length; i++) {
        switch (findBlockchain[i].blockchain_id) {
          case '8000003C':
          case '8000025B':
          case '80000CFC':
            tpsItems.push(Utils.getETHTps(findBlockchain[i].blockchain_id, findBlockchain[i].block));
            break;
          case '80000000':
          case '80000001':
            tpsItems.push(Utils.getBTCTps(findBlockchain[i].blockchain_id, findBlockchain[i].block));
            break;
          default:
            break;
        }
      }

      const items = [];
      const findAllTps = await Promise.all(tpsItems).catch((error) => new ResponseFormat({ message: `rpc error(${error})`, code: Codes.RPC_ERROR }));
      if (findAllTps.code === Codes.RPC_ERROR) return 0;
      findAllTps.forEach((tps, i) => {
        items.push({
          blockchainId: findBlockchain[i].blockchain_id,
          name: findBlockchain[i].name,
          tps,
          blockHeight: findBlockchain[i].block,
          avgFee: findBlockchain[i].avg_fee,
        });
      });

      const findAllAmount = await this.blockchainModel.count();
      const meta = {
        hasNext: false,
        nextIndex: 0,
        count: findAllAmount || 0,
      };

      if (items.length > Number(limit)) {
        items.pop();
        meta.hasNext = true;
        meta.nextIndex = Number(index) + Number(limit);
      }

      return new ResponseFormat({ message: 'Explore Node Info', items, meta });
    } catch (e) {
      this.logger.error('NodeInfo e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: `DB Error(${e.message})`, code: Codes.DB_ERROR });
    }
  }

  async AddressDetail({ params }) {
    try {
      const { address } = params;

      const findAddress = await this.accountAddressModel.findAll({
        where: { address },
        attributes: ['account_id', 'address'],
        include: [
          {
            model: this.accountModel,
            attributes: ['blockchain_id'],
          },
        ],
      });

      if (!findAddress) return new ResponseFormat({ message: 'account not found', code: Codes.ACCOUNT_NOT_FOUND });

      const balance = [];
      for (let i = 0; i < findAddress.length; i++) {
        const addressItem = findAddress[i];

        let _balance = '0';
        switch (addressItem.Account.blockchain_id) {
          case '8000003C':
          case '8000025B':
          case '80000CFC':
            _balance = await Utils.ethGetBalanceByAddress(addressItem.Account.blockchain_id, address, 18);
            break;
          case '80000000':
          case '80000001':
            // eslint-disable-next-line no-case-declarations
            const findAccountCurrency = await this.accountCurrencyModel.findOne({
              where: { account_id: addressItem.account_id },
            });
            if (findAccountCurrency && findAccountCurrency.balance) _balance = findAccountCurrency.balance;
            break;
          default:
            break;
        }
        balance.push({
          blockchainId: addressItem.Account.blockchain_id,
          name: await this.blockchainIdToName(addressItem.Account.blockchain_id),
          address,
          balance: _balance,
        });
      }

      return new ResponseFormat({ message: 'Explore Address Detail', payload: { balance } });
    } catch (e) {
      this.logger.error('NodeInfo e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: `DB Error(${e.message})`, code: Codes.DB_ERROR });
    }
  }

  async AddressTransactions({ params }) {
    try {
      const { address } = params;

      const findAddress = await this.accountAddressModel.findOne({
        where: { address },
        attributes: ['accountAddress_id', 'account_id', 'address'],
        include: [
          {
            model: this.addressTokenTransactionModel,
            // attributes: ['blockchain_id'],
          },
        ],
      });

      // count all amount
      // let findAllAmount = await this.addressTransactionModel.count({
      //   where: { accountAddress_id: findAddress.accountAddress_id },
      // });
      // for (const tokenTxItem of findAddress.AddressTokenTransactions) {
      //   findAllAmount += await this.addressTokenTransactionModel.count({
      //     where: { accountAddress_id: tokenTxItem.accountAddress_id },
      //   });
      // }
      // const meta = {
      //   hasNext: false,
      //   nextIndex: 0,
      //   count: findAllAmount || 0,
      // };

      // if (items.length > Number(limit)) {
      //   items.pop();
      //   meta.hasNext = true;
      //   meta.nextIndex = Number(index) + Number(limit);
      // }

      // return new ResponseFormat({ message: 'Explore Address Transactions', payload: findAddress });
      const items = [
        {
          blockchainId: '8000003C',
          iconUrl: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@9ab8d6934b83a4aa8ae5e8711609a70ca0ab1b2b/32/icon/eth.png',
          txHash: '0xfeec336202de22484a7f992ddd7020e1925cdf35ee3d6164375c519b57003628',
          symbol: 'ETH',
          block: '600010',
          timestamp: 1615450230,
          from: '0x5b43760f7760fb0304c0716609dc5c266d60db8f',
          to: '0xa1d8d972560c2f8144af871db508f0b0b10a3fbf',
          value: '1.209423506',
          fee: '0.000000112 ',
        },
      ];
      const meta = {
        hasNext: false,
        nextIndex: 0,
        count: 1,
      };

      return new ResponseFormat({ message: 'Explore Address Transactions', items, meta });
    } catch (e) {
      this.logger.error('NodeInfo e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: `DB Error(${e.message})`, code: Codes.DB_ERROR });
    }
  }

  async Search({ params }) {
    try {
      const { search_string } = params;

      const payload = {
        block: [],
        transaction: [],
        address: [],
      };

      const findBlocks = await this.blockScannedModel.findAll({
        limit: 10,
        where: {
          block_hash: { [this.Sequelize.Op.startsWith]: search_string },
        },
        attributes: ['block_hash', 'blockchain_id'],
      });
      if (findBlocks) {
        payload.block = findBlocks.map((item) => ({
          blockHash: item.block_hash, blockchainId: item.blockchain_id,
        }));
      }

      const findTokenTxs = await this.tokenTransactionModel.findAll({
        limit: 5,
        where: {
          txid: { [this.Sequelize.Op.startsWith]: search_string },
        },
        attributes: ['txid'],
      });
      if (findTokenTxs) payload.transaction = findTokenTxs.map((item) => ({ txid: item.txid }));
      const txLen = findTokenTxs.length;

      const findTxs = await this.transactionModel.findAll({
        limit: 10 - txLen,
        where: {
          txid: { [this.Sequelize.Op.startsWith]: search_string },
        },
        attributes: ['txid'],
      });
      if (findTxs) {
        findTxs.forEach((item) => {
          if (payload.transaction.findIndex((x) => x.txid === item.txid) === -1)payload.transaction.push({ txid: item.txid });
        });
      }

      const findAddresses = await this.accountAddressModel.findAll({
        limit: 10,
        where: {
          address: { [this.Sequelize.Op.startsWith]: search_string },
        },
        attributes: ['address'],
      });
      if (findAddresses) {
        findAddresses.forEach((item) => {
          if (payload.address.findIndex((x) => x.txid === item.txid) === -1)payload.address.push({ address: item.address });
        });
      }

      return new ResponseFormat({ message: 'Explore Address Transactions', payload });
    } catch (e) {
      this.logger.error('Search e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: `DB Error(${e.message})`, code: Codes.DB_ERROR });
    }
  }
}

module.exports = Explore;
