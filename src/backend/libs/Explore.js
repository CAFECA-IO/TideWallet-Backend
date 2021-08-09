const Bot = require('./Bot');
const Utils = require('./Utils');
const ResponseFormat = require('./ResponseFormat');
const Codes = require('./Codes');
const DBOperator = require('./DBOperator');

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
      this.DBOperator = new DBOperator(this.config, this.database, this.logger);
      this.defaultDBInstance = this.database.db[Utils.defaultDBInstanceName];

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

      this.sequelize = this.defaultDBInstance.sequelize;
      this.Sequelize = this.defaultDBInstance.Sequelize;
      return this;
    });
  }

  async blockchainIdToName(blockchain_id) {
    if (this.blockchainName[blockchain_id]) return this.blockchainName[blockchain_id];
    const findOne = await this.DBOperator.findOne({
      tableName: 'Blockchain',
      options: {
        where: { blockchain_id },
        attributes: ['name'],
      },
    });
    if (!findOne) return '';

    this.blockchainName[blockchain_id] = findOne.name;
    return findOne.name;
  }

  async TransactionDetail({ params }) {
    try {
      const { txid } = params;
      const payload = [];

      const findTx = await this.DBOperator.findOne({
        tableName: 'Transaction',
        options: {
          where: { txid },
          include: [
            {
              _model: 'Currency',
              attributes: ['blockchain_id', 'name', 'icon', 'symbol', 'decimals'],
            },
          ],
        },
      });
      if (!findTx) return new ResponseFormat({ message: 'transaction not found', code: Codes.TX_NOT_FOUND });

      payload.push({
        blockchainId: findTx.Currency.blockchain_id,
        iconUrl: Utils.formatIconUrl(findTx.Currency.icon),
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
      const findTokenTx = await this.DBOperator.findAll({
        tableName: 'TokenTransaction',
        options: {
          where: { txid },
          include: [
            {
              _model: 'Currency',
              attributes: ['blockchain_id', 'name', 'icon', 'symbol', 'decimals'],
            },
          ],
        },
      });
      if (findTokenTx) {
        findTokenTx.forEach((txItem) => {
          payload.push({
            blockchainId: txItem.Currency.blockchain_id,
            iconUrl: Utils.formatIconUrl(txItem.Currency.icon),
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
      console.log('e:', e); // -- no console.log
      this.logger.error('TransactionDetail e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: `DB Error(${e.message})`, code: Codes.DB_ERROR });
    }
  }

  // TODO: support multi paging
  async TransactionList({ query }) {
    try {
      const { index = 0, limit = 20 } = query;

      const findTransactionList = await this.DBOperator.query(
        `SELECT
            t1.*,
            "Currency"."blockchain_id" AS "currency_blockchain_id",
            "Currency"."name" AS "currency_name",
            "Currency"."icon" AS "currency_icon",
            "Currency"."symbol" AS "currency_symbol",
            "Currency"."decimals" AS "currency_decimals"
          FROM ((
              SELECT
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
          UNION (
            SELECT
              "TokenTransaction"."transaction_id",
              "TokenTransaction"."currency_id",
              "TokenTransaction"."txid",
              "TokenTransaction"."timestamp",
              "TokenTransaction"."source_addresses",
              "TokenTransaction"."destination_addresses",
              "TokenTransaction"."amount",
              "Transaction"."block",
              "Transaction"."fee"
            FROM
              "TokenTransaction"
            LEFT OUTER JOIN "Transaction" AS "Transaction" ON "Transaction"."transaction_id" = "TokenTransaction"."transaction_id"
          ORDER BY
            "transaction_id" DESC
          LIMIT :limit OFFSET :index)) AS t1
            LEFT OUTER JOIN "Currency" AS "Currency" ON "t1"."currency_id" = "Currency"."currency_id"
          ORDER BY
            "transaction_id" DESC`,
        {
          replacements: {
            index: Number(index),
            limit: Math.floor(Number(limit) + 1),
          },
        },
      );

      const items = [];
      const findAllAmount = await this.DBOperator.count({
        tableName: 'Transaction',
      }) + await this.DBOperator.count({
        tableName: 'TokenTransaction',
      });
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
            iconUrl: Utils.formatIconUrl(txItem.currency_icon),
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
          console.log('breakFlag'); // -- no console.log
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

  // TODO: support multi paging
  async BlockList({ query }) {
    try {
      const { index = 0, limit = 20 } = query;
      const findBlocks = await this.DBOperator.findAll({
        tableName: 'BlockScanned',
        options: {
          offset: Number(index),
          limit: Number(limit) + 1,
          attributes: ['blockchain_id', 'block', 'block_hash', 'timestamp', 'result'],
          order: [['timestamp', 'DESC']],
        },
      });
      const items = [];

      for (const item of findBlocks) {
        const itemJSON = JSON.parse(item.result);

        // eslint-disable-next-line no-nested-ternary
        const txCount = (itemJSON.nTx !== undefined)
          ? itemJSON.nTx
          : (itemJSON.transactions)
            ? itemJSON.transactions.length
            : itemJSON.length || 0;
        items.push({
          blockchainId: item.blockchain_id,
          name: await this.blockchainIdToName(item.blockchain_id),
          blockHeight: item.block,
          blockHash: item.block_hash,
          timestamp: item.timestamp,
          txCount,
        });
      }
      const findAllAmount = await this.DBOperator.count({
        tableName: 'BlockScanned',
      });

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

      const DBName = Utils.blockchainIDToDBName(blockchain_id);
      const _db = this.database.db[DBName];
      const findBlockInfo = await _db.BlockScanned.findOne({
        where: { blockchain_id, block_hash: block_id },
        attributes: ['blockchain_id', 'block', 'timestamp', 'result'],
      });
      if (!findBlockInfo) return new ResponseFormat({ message: 'block not found', code: Codes.BLOCK_NOT_FOUND });

      const itemJSON = JSON.parse(findBlockInfo.result);

      // eslint-disable-next-line no-nested-ternary
      const txCount = (itemJSON.nTx !== undefined)
        ? itemJSON.nTx
        : (itemJSON.transactions)
          ? itemJSON.transactions.length
          : itemJSON.length || 0;

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

  // TODO: support multi paging
  async BlockTransactions({ params, query }) {
    try {
      const { blockchain_id, block_id } = params;
      const { index = 0, limit = 20 } = query;

      const DBName = Utils.blockchainIDToDBName(blockchain_id);
      const _db = this.database.db[DBName];
      const findBlockInfo = await _db.BlockScanned.findOne({
        where: { blockchain_id, block_hash: block_id },
        attributes: ['blockchain_id', 'block', 'timestamp', 'result'],
      });

      const items = [];
      const meta = {
        hasNext: false,
        nextIndex: 0,
        count: 0,
      };
      if (!findBlockInfo) {
        return new ResponseFormat({
          message: 'block not found', items, meta, code: Codes.BLOCK_NOT_FOUND,
        });
      }

      const itemJSON = JSON.parse(findBlockInfo.result);

      // eslint-disable-next-line no-nested-ternary
      const txCount = (itemJSON.nTx !== undefined)
        ? itemJSON.nTx
        : (itemJSON.transactions)
          ? itemJSON.transactions.length
          : itemJSON.length || 0;
      meta.count = txCount;
      // eslint-disable-next-line no-nested-ternary
      const txs = (itemJSON.tx !== undefined)
        ? itemJSON.tx
        : (itemJSON.transactions)
          ? itemJSON.transactions
          : itemJSON || [];

      const endIndex = Number(index) + Number(limit) + 1;
      const loopEndIndex = Math.min(txs.length, endIndex);
      for (let i = index; i < loopEndIndex; i++) {
        const txItem = txs[i];
        // eslint-disable-next-line no-nested-ternary
        const txid = (txItem.txid)
          ? txItem.txid
          : (txItem.hash)
            ? txItem.hash
            : txItem;
        const findTx = await _db.Transaction.findOne({
          where: { txid },
          attributes: ['transaction_id', 'currency_id', 'txid', 'timestamp', 'source_addresses', 'destination_addresses', 'amount', 'block', 'fee'],
          include: [
            {
              model: _db.Currency,
              attributes: ['blockchain_id', 'name', 'icon', 'symbol', 'decimals'],
            },
          ],
        });
        if (findTx) {
          items.push({
            blockchainId: findTx.Currency.blockchain_id,
            iconUrl: Utils.formatIconUrl(findTx.Currency.icon),
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
      const findBlockchain = await this.DBOperator.findAll({
        tableName: 'Blockchain',
        options: {
          attributes: ['blockchain_id', 'name', 'block', 'avg_fee'],
        },
      });

      // TODO: use db data to calculator
      // calculator tps
      const tpsItems = [];
      for (let i = 0; i < findBlockchain.length; i++) {
        switch (findBlockchain[i].blockchain_id) {
          case '8000003C':
          case 'F000003C':
          case '80000CFC':
            tpsItems.push(Utils.getETHTps(findBlockchain[i].blockchain_id, findBlockchain[i].block));
            break;
          case '80000000':
          case 'F0000000':
            tpsItems.push(Utils.getBTCTps(findBlockchain[i].blockchain_id, findBlockchain[i].block));
            break;
          case '80000091':
          case 'F0000091': // ++ TODO change bch testnet blocId by Emily 2021.05.24
            tpsItems.push(Utils.getBCHTps(findBlockchain[i].blockchain_id, findBlockchain[i].block));
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

      const findAllAmount = await this.DBOperator.count({
        tableName: 'Blockchain',
      });
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

      const findAddress = await this.DBOperator.findOne({
        tableName: 'AccountAddress',
        options: {
          where: { address },
          attributes: ['account_id', 'address'],
          include: [
            {
              _model: 'Account',
              attributes: ['blockchain_id'],
            },
          ],
        },
      });

      if (findAddress && findAddress.length > 0) {
        const balance = [];
        for (let i = 0; i < findAddress.length; i++) {
          const addressItem = findAddress[i];

          let _balance = '0';
          switch (addressItem.Account.blockchain_id) {
            case '8000003C':
            case 'F000003C':
            case '80000CFC':
              _balance = await Utils.ethGetBalanceByAddress(addressItem.Account.blockchain_id, address, 18);
              break;
            case '80000000':
            case 'F0000000':
            case '80000091':
            case 'F0000091':
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
      }

      // TODO: refactor it, logic same as (findAddress)
      // not in account address, find transaction table
      const findBlockID = {};
      const findAddressTxs = await this.DBOperator.findAll({
        tableName: 'Transaction',
        options: {
          where: {
            [this.Sequelize.Op.or]: [{ source_addresses: address }, { destination_addresses: address }],
          },
          attributes: ['txid'],
          include: [
            {
              _model: 'Currency',
              attributes: ['blockchain_id'],
            },
          ],
        },
      });
      findAddressTxs.forEach((item) => {
        if (item.Currency) findBlockID[item.Currency.blockchain_id] = true;
      });

      const blockchainList = Object.keys(findBlockID);

      if (blockchainList.length === 0) return new ResponseFormat({ message: 'account not found', code: Codes.ACCOUNT_NOT_FOUND });

      const balance = [];
      for (const addressItemBlockchainID of blockchainList) {
        let _balance = '0';
        switch (addressItemBlockchainID) {
          case '8000003C':
          case 'F000003C':
          case '80000CFC':
            _balance = await Utils.ethGetBalanceByAddress(addressItemBlockchainID, address, 18);
            break;
          case '80000000':
          case 'F0000000':
            // TODO: not support btc now
            break;
          default:
            break;
        }
        balance.push({
          blockchainId: addressItemBlockchainID,
          name: await this.blockchainIdToName(addressItemBlockchainID),
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

  // TODO: support multi paging
  async AddressTransactions({ params, query }) {
    try {
      const { address } = params;
      const { index = 0, limit = 20 } = query;

      let isServerAccount = true;
      // STEP 1. find accountAddressModel first
      let findAddress = await this.DBOperator.findOne({
        tableName: 'AccountAddress',
        options: {
          where: { address },
          attributes: ['accountAddress_id', 'account_id', 'address'],
        },
      });

      if (!findAddress) {
        isServerAccount = false;
        // STEP 2. find transactionModel if accountAddressModel not found
        findAddress = await this.DBOperator.findOne({
          tableName: 'Transaction',
          options: {
            attributes: ['txid'],
          },
          operators: {
            or: [{ source_addresses: address }, { destination_addresses: address }],
          },
        });

        if (!findAddress) {
          // STEP 3. find tokenTransactionModel if transactionModel not found
          findAddress = await this.DBOperator.findOne({
            tableName: 'TokenTransaction',
            options: {
              attributes: ['txid'],
            },
            operators: {
              or: [{ source_addresses: address }, { destination_addresses: address }],
            },
          });

          if (!findAddress) {
            return new ResponseFormat({
              message: 'Explore Address Transactions',
              items: [],
              meta: {
                hasNext: false,
                nextIndex: 0,
                count: 0,
              },
            });
          }
        }
      }

      // TODO: refactor it, logic same as isServerAccount
      if (!isServerAccount) {
        // not account address, find by source_addresses || destination_addresses

        // find transactionModel
        const findTxs = await this.DBOperator.findAll({
          tableName: 'Transaction',
          options: {
            offset: index,
            limit,
            include: [
              {
                _model: 'Currency',
                attributes: ['blockchain_id', 'symbol', 'icon', 'decimals'],
              },
            ],
            order: [['transaction_id', 'DESC']],
          },
          operators: {
            or: [{ source_addresses: address }, { destination_addresses: address }],
          },
        });

        const findTokenTxs = await this.DBOperator.findAll({
          tableName: 'TokenTransaction',
          options: {
            offset: index,
            limit,
            include: [
              {
                _model: 'Transaction',
              },
              {
                _model: 'Currency',
                attributes: ['blockchain_id', 'symbol', 'icon', 'decimals'],
              },
            ],
            order: [['tokenTransaction_id', 'DESC']],
          },
          operators: {
            or: [{ source_addresses: address }, { destination_addresses: address }],
          },
        });

        const txs = [...findTxs, ...findTokenTxs];
        txs.sort((a, b) => b.timestamp - a.timestamp);

        const items = [];
        for (let i = 0; i < Math.min(txs.length, Number(limit) + 1); i++) {
          const txItem = txs[i];
          let txHash = '';
          let block = 0;
          let timestamp = 0;
          let from = '';
          let to = '';
          let _fee = '0';
          if (txItem.Transaction) {
            ({
              txid: txHash, block, timestamp, source_addresses: from, destination_addresses: to, fee: _fee,
            } = txItem.Transaction);
          } else {
            ({
              txid: txHash, block, timestamp, source_addresses: from, destination_addresses: to, fee: _fee,
            } = txItem);
          }
          items.push({
            blockchainId: txItem.Currency.blockchain_id,
            iconUrl: Utils.formatIconUrl(txItem.Currency.icon),
            txHash,
            symbol: txItem.Currency.symbol,
            block,
            timestamp,
            from,
            to,
            value: Utils.dividedByDecimal(txItem.amount, txItem.Currency.decimals),
            fee: Utils.dividedByDecimal(_fee, txItem.Currency.decimals),
          });
        }

        // count all amount
        const findAllAmount = await this.DBOperator.count({
          tableName: 'Transaction',
          operators: {
            or: [{ source_addresses: address }, { destination_addresses: address }],
          },
        }) + await this.DBOperator.count({
          tableName: 'TokenTransaction',
          operators: {
            or: [{ source_addresses: address }, { destination_addresses: address }],
          },
        });

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

        return new ResponseFormat({ message: 'Explore Address Transactions', items, meta });
      }

      // find transaction
      const findTxs = await this.addressTransactionModel.findAll({
        where: { accountAddress_id: findAddress.accountAddress_id },
        offset: index,
        limit,
        include: [
          {
            model: this.transactionModel,
          },
          {
            model: this.currencyModel,
            attributes: ['blockchain_id', 'symbol', 'icon', 'decimals'],
          },
        ],
        order: [['addressTransaction_id', 'DESC']],
      });

      // find token transaction
      const findTokenTxs = await this.addressTokenTransactionModel.findAll({
        where: { accountAddress_id: findAddress.accountAddress_id },
        offset: index,
        limit,
        include: [
          {
            model: this.tokenTransactionModel,
            include: [
              {
                model: this.transactionModel,
              },
            ],
          },
          {
            model: this.currencyModel,
            attributes: ['blockchain_id', 'symbol', 'icon', 'decimals'],
          },
        ],
        order: [['addressTokenTransaction_id', 'DESC']],
      });

      const txs = [...findTxs, ...findTokenTxs];
      txs.sort((a, b) => b.Transaction.timestamp - a.Transaction.timestamp);

      const items = [];
      for (let i = 0; i < Math.min(txs.length, Number(limit) + 1); i++) {
        const txItem = txs[i];
        let txHash = '';
        let block = 0;
        let timestamp = 0;
        let from = '';
        let to = '';
        let _fee = '0';
        if (txItem.TokenTransaction) {
          ({
            txid: txHash, block, timestamp, source_addresses: from, destination_addresses: to, fee: _fee,
          } = txItem.TokenTransaction.Transaction);
        } else {
          ({
            txid: txHash, block, timestamp, source_addresses: from, destination_addresses: to, fee: _fee,
          } = txItem.Transaction);
        }
        items.push({
          blockchainId: txItem.Currency.blockchain_id,
          iconUrl: Utils.formatIconUrl(txItem.Currency.icon),
          txHash,
          symbol: txItem.Currency.symbol,
          block,
          timestamp,
          from,
          to,
          value: Utils.dividedByDecimal(txItem.amount, txItem.Currency.decimals),
          fee: Utils.dividedByDecimal(_fee, txItem.Currency.decimals),
        });
      }

      // count all amount
      const findAllAmount = await this.addressTransactionModel.count({
        where: { accountAddress_id: findAddress.accountAddress_id },
      }) + await this.addressTokenTransactionModel.count({
        where: { accountAddress_id: findAddress.accountAddress_id },
      });

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

      return new ResponseFormat({ message: 'Explore Address Transactions', items, meta });
    } catch (e) {
      console.log('e:', e); // -- no console.log
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

      const searchItems = await Promise.all([
        this.DBOperator.findAll({
          tableName: 'BlockScanned',
          options: {
            limit: 10,
            where: {
              block_hash: search_string,
            },
            attributes: ['block_hash', 'blockchain_id'],
          },
        }),
        this.DBOperator.findAll({
          tableName: 'TokenTransaction',
          options: {
            limit: 5,
            where: {
              txid: search_string,
            },
            attributes: ['txid'],
          },
        }),
        this.DBOperator.findAll({
          tableName: 'TokenTransaction',
          options: {
            limit: 5,
            where: {
              [this.Sequelize.Op.or]: [{ source_addresses: search_string }, { destination_addresses: search_string }],
            },
            attributes: ['txid'],
          },
        }),
        this.DBOperator.findAll({
          tableName: 'AccountAddress',
          options: {
            limit: 10,
            where: {
              address: search_string,
            },
            attributes: ['address'],
          },
        }),
      ]).catch((error) => new ResponseFormat({ message: `rpc error(${error})`, code: Codes.RPC_ERROR }));
      if (searchItems.code === Codes.RPC_ERROR) return searchItems;

      if (searchItems[0]) {
        payload.block = searchItems[0].map((item) => ({
          blockHash: item.block_hash, blockchainId: item.blockchain_id,
        }));
      }

      if (searchItems[1]) payload.transaction = searchItems[1].map((item) => ({ txid: item.txid }));
      const txLen = searchItems[1].length;

      if ((10 - txLen) > 0) {
        const findTxs = await this.DBOperator.findAll({
          tableName: 'Transaction',
          options: {
            limit: 10 - txLen,
            where: {
              [this.Sequelize.Op.or]: [{ source_addresses: search_string }, { destination_addresses: search_string }],
            },
            attributes: ['txid'],
          },
        });
        if (findTxs) {
          findTxs.forEach((item) => {
            if (payload.transaction.findIndex((x) => x.txid === item.txid) === -1)payload.transaction.push({ txid: item.txid });
          });
        }
      }

      const txLen2 = searchItems[2].length;
      if ((10 - txLen2) > 0) {
        const findTxs = await this.DBOperator.findAll({
          tableName: 'Transaction',
          options: {
            limit: 10 - txLen2,
            where: {
              txid: search_string,
            },
            attributes: ['txid'],
          },
        });
        if (findTxs) {
          findTxs.forEach((item) => {
            if (payload.transaction.findIndex((x) => x.txid === item.txid) === -1)payload.transaction.push({ txid: item.txid });
          });
        }
      }

      if (searchItems[3]) {
        searchItems[3].forEach((item) => {
          if (payload.address.findIndex((x) => x.txid === item.txid) === -1)payload.address.push({ address: item.address });
        });
      }

      return new ResponseFormat({ message: 'Explore Search', payload });
    } catch (e) {
      console.log('e', e); // -- no console.log
      this.logger.error('Search e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: `DB Error(${e.message})`, code: Codes.DB_ERROR });
    }
  }
}

module.exports = Explore;
