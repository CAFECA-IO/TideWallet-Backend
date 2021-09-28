const { default: BigNumber } = require('bignumber.js');
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
      const { blockchain_id, address } = params;

      const balance = [];

      let _balance = '0';
      switch (blockchain_id) {
        case '8000003C':
        case 'F000003C':
        case '80000CFC':
          _balance = await Utils.ethGetBalanceByAddress(blockchain_id, address, 18);
          break;
        case '80000000':
        case 'F0000000':
          // TODO: not support btc now
          _balance = await this.CalculateAmount({ params });
          break;
        default:
          break;
      }
      balance.push({
        blockchainId: blockchain_id,
        name: await this.blockchainIdToName(blockchain_id),
        address,
        balance: _balance,
      });

      return new ResponseFormat({ message: 'Explore Address Detail', payload: { balance } });
    } catch (e) {
      this.logger.error('NodeInfo e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: `DB Error(${e.message})`, code: Codes.DB_ERROR });
    }
  }

  async CalculateAmount({ params }) {
    const { blockchain_id, address } = params;

    const lowerAddr = address.toLowerCase();

    const DBName = Utils.blockchainIDToDBName(blockchain_id);
    const _db = this.database.db[DBName];

    const findChainCurrency = await _db.Currency.findOne({
      where: { type: 1, blockchain_id },
    });

    const findAddressTxs = await _db.AddressTransaction.findAll({
      where: {
        currency_id: findChainCurrency.currency_id,
        // 下面這段吃不到index
        // address: [this.Sequelize.fn('LOWER', this.Sequelize.col('address')), lowerAddr],
        // 要改db與parser，存的內容要tolower，或把欄位改成citext
        // address: lowerAddr,
        address,
      },
      // logging: console.log,
      attributes: ['transaction_id', 'amount', 'direction', 'address'],
    });

    let balance = new BigNumber(0);

    if (findAddressTxs && findAddressTxs.length > 0) {
      for (const tx of findAddressTxs) {
        if (tx.direction === 0) {
          balance = balance.minus(new BigNumber(tx.amount));
        }
        if (tx.direction === 1) {
          balance = balance.plus(new BigNumber(tx.amount));
        }
      }
    }
    return balance.toFixed();
  }

  // 順序好像怪怪的
  async AddressTransactions({ params, query }) {
    try {
      const { blockchain_id, address } = params;
      const {
        limit = 20, isGetOlder = true, timestamp = Math.floor(Date.now() / 1000),
      } = query;

      // find blockchain info
      const findBlockchainInfo = await this.DBOperator.findOne({
        tableName: 'Blockchain',
        options: {
          where: { blockchain_id },
        },
      });

      const DBName = Utils.blockchainIDToDBName(blockchain_id);
      const _db = this.database.db[DBName];
      const lowerAddr = address.toLowerCase();
      const txs = [];

      const findChainCurrency = await _db.Currency.findOne({
        where: { type: 1, blockchain_id },
      });

      const where = {
        currency_id: findChainCurrency.currency_id,
        // address: lowerAddr,
        address,
      };
      const order = isGetOlder === 'true' ? [['Transaction', 'timestamp', 'DESC']] : [['Transaction', 'timestamp', 'ASC']];

      const findTxByAddress = await _db.AddressTransaction.findAll({
        where,
        limit: Number(limit),
        order,
        include: [
          {
            model: _db.Transaction,
            where: {
              timestamp: isGetOlder === 'true' ? { [this.Sequelize.Op.lt]: timestamp } : { [this.Sequelize.Op.gt]: timestamp },
            },
          },
        ],
      });

      if (findTxByAddress) {
        for (let j = 0; j < findTxByAddress.length; j++) {
          const txInfo = findTxByAddress[j];
          const amount = Utils.dividedByDecimal(txInfo.amount, findChainCurrency.decimals);
          const gas_price = txInfo.Transaction.gas_price
            ? Utils.dividedByDecimal(txInfo.Transaction.gas_price, findChainCurrency.decimals)
            : null;
          const fee = txInfo.Transaction.fee
            ? Utils.dividedByDecimal(txInfo.Transaction.fee, findChainCurrency.decimals)
            : null;

          txs.push({
            id: txInfo.addressTransaction_id,
            txid: txInfo.Transaction.txid,
            status: findTxByAddress.result ? 'success' : 'failed',
            amount,
            symbol: findChainCurrency.symbol, // "unit"
            direction: txInfo.direction === 0 ? 'send' : 'receive',
            confirmations: findBlockchainInfo.block - txInfo.Transaction.block + 1,
            timestamp: txInfo.Transaction.timestamp,
            source_addresses: Utils.formatAddressArray(txInfo.Transaction.source_addresses),
            destination_addresses: Utils.formatAddressArray(txInfo.Transaction.destination_addresses),
            fee,
            gas_price,
            gas_used: txInfo.Transaction.gas_used,
            note: txInfo.Transaction.note,
          });
        }
        const items = this._mergeInternalTxs({ txs });

        // sort by timestamps
        items.sort((a, b) => b.timestamp - a.timestamp >= 0);

        return new ResponseFormat({
          message: 'Explore Address Transactions',
          // items,
          // meta,
          payload: items,
        });
      }
      return new ResponseFormat({ message: 'Address not found', code: Codes.ADDRESS_NOT_FOUND });
    } catch (e) {
      console.log('e:', e); // -- no console.log
      this.logger.error('NodeInfo e:', e);
      if (e.code) return e;
      return new ResponseFormat({ message: `DB Error(${e.message})`, code: Codes.DB_ERROR });
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
      // fix for null from address
      if (!tmpTxs[key].tx.source_addresses)tmpTxs[key].tx.source_addresses = '2N4iKXLjajWZHJhz9pYdhr6jHbzKThvm8D4';
      result.push(tmpTxs[key].tx);
    });

    return result;
  }

  async ContractCode({ params }) {
    const { blockchain_id, contract } = params;
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
        return new ResponseFormat({
          message: 'blockchain has not token',
          code: Codes.BLOCKCHAIN_HAS_NOT_TOKEN,
        });
    }
    let contractCode;
    try {
      contractCode = await Utils.getContractCodeFromPeer(options, contract);
    } catch (error) {
      return new ResponseFormat({
        message: `rpc error(${error})`,
        code: Codes.RPC_ERROR,
      });
    }

    if (!contractCode) {
      return new ResponseFormat({
        message: 'contract not found',
        code: Codes.CONTRACT_CONT_FOUND,
      });
    }
    return new ResponseFormat({
      message: '',
      payload: {
        contract_code: contractCode,
      },
    });
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
