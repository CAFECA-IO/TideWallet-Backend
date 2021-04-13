const os = require('os');
const fs = require('fs');
const path = require('path');
const level = require('level');
const bs58check = require('bs58check');
const EthUtils = require('ethereumjs-util');
const crypto = require('crypto');
const bitcoin = require('bitcoinjs-lib');
const BigNumber = require('bignumber.js');
const log4js = require('log4js');

const Web3 = require('web3');

const { BN } = EthUtils;
const toml = require('toml');
const randToken = require('rand-token');
const JWT = require('jsonwebtoken');
const i18n = require('i18n');
const dvalue = require('dvalue');
const ecRequest = require('ecrequest');
const blockchainNetworks = require('./data/blockchainNetworks');

const Codes = require('./Codes');
const ResponseFormat = require('./ResponseFormat');
const initialORM = require('../../database/models');

class Utils {
  constructor() {
    // assign by readConfig
    this.config = {};
    this.logger = {};
    this.database = {};
  }

  static waterfallPromise(jobs) {
    return jobs.reduce((prev, curr) => prev.then(() => curr()), Promise.resolve());
  }

  static retryPromise(promise, args, maxTries, context = null, timeout) {
    return promise.apply(context, args)
      .then((d) => Promise.resolve(d),
        (e) => {
          if (maxTries <= 0) return Promise.reject(e);

          return new Promise((resolve, reject) => {
            setTimeout(() => {
              this.retryPromise(promise, args, maxTries - 1, context, timeout)
                .then(resolve, reject);
            }, timeout || 0);
          });
        });
  }

  static toHex(n) {
    return `0x${(n).toString(16)}`;
  }

  static zeroFill(i, l) {
    let s = i.toString();
    if (l > s.length) {
      s = `${new Array(l - s.length).fill(0).join('')}${s}`;
    }
    return s;
  }

  static parseBoolean(bool) {
    return typeof (bool) === 'string'
      ? bool.toLowerCase() !== 'false'
      : !!bool;
  }

  static parseTime(timestamp) {
    let result;
    const uptime = new Date().getTime() - timestamp;
    if (uptime > 86400 * 365 * 1000) {
      result = `${(uptime / (86400 * 365 * 1000)).toFixed(2)} Yrs`;
    } else if (uptime > 86400 * 30 * 1000) {
      result = `${(uptime / (86400 * 30 * 1000)).toFixed(2)} Mon`;
    } else if (uptime > 86400 * 1000) {
      result = `${(uptime / (86400 * 1000)).toFixed(2)} Day`;
    } else if (uptime > 3600 * 1000) {
      result = `${(uptime / (3600 * 1000)).toFixed(2)} Hrs`;
    } else if (uptime > 60 * 1000) {
      result = `${(uptime / (60 * 1000)).toFixed(2)} Min`;
    } else {
      result = `${(uptime / (1000)).toFixed(2)} Sec`;
    }
    return result;
  }

  static jsonStableStringify(obj, opts = {}) {
    if (typeof opts === 'function') opts = { cmp: opts };
    let space = opts.space || '';
    if (typeof space === 'number') space = Array(space + 1).join(' ');
    const cycles = (typeof opts.cycles === 'boolean') ? opts.cycles : false;
    // eslint-disable-next-line func-names
    const replacer = opts.replacer || function (key, value) { return value; };

    // eslint-disable-next-line func-names
    const cmp = opts.cmp && (function (f) {
      return (node) => {
        // eslint-disable-next-line no-unused-expressions
        (a, b) => {
          const aobj = { key: a, value: node[a] };
          const bobj = { key: b, value: node[b] };
          return f(aobj, bobj);
        };
      };
    }(opts.cmp));

    const seen = [];
    return (function stringify(parent, key, node, levelDB) {
      const indent = space ? (`\n${new Array(levelDB + 1).join(space)}`) : '';
      const colonSeparator = space ? ': ' : ':';

      if (node && node.toJSON && typeof node.toJSON === 'function') {
        node = node.toJSON();
      }

      node = replacer.call(parent, key, node);

      if (node === undefined) {
        return;
      }
      if (typeof node !== 'object' || node === null) {
        return JSON.stringify(node);
      }
      if (Array.isArray(node)) {
        const out = [];
        for (let i = 0; i < node.length; i++) {
          const item = stringify(node, i, node[i], levelDB + 1) || JSON.stringify(null);
          out.push(indent + space + item);
        }
        return `[${out.join(',')}${indent}]`;
      }
      if (seen.indexOf(node) !== -1) {
        if (cycles) return JSON.stringify('__cycle__');
        throw new TypeError('Converting circular structure to JSON');
      } else {
        seen.push(node);
      }
      const keys = Object.keys(node).sort(cmp && cmp(node));
      const out = [];
      for (let i = 0; i < keys.length; i++) {
        const keyItem = keys[i];
        const value = stringify(node, keyItem, node[key], levelDB + 1);

        if (value) {
          const keyValue = JSON.stringify(keyItem) + colonSeparator + value;
          out.push(indent + space + keyValue);
        }
      }
      seen.splice(seen.indexOf(node), 1);
      return `{${out.join(',')}${indent}}`;
    }({ '': obj }, '', obj, 0));
  }

  static toToml(data, notRoot) {
    let result;
    if (data instanceof Object || typeof data === 'object') {
      result = Object.keys(data)
        .map((v) => {
          if (data[v] instanceof Object || typeof data[v] === 'object') {
            return `[${v}]\r\n${this.toToml(data[v], true)}\r\n`;
          } if (typeof (data[v]) === 'string') {
            return `${v} = "${data[v]}"${!notRoot ? '\r\n' : ''}`;
          }
          return `${v} = ${data[v]}${!notRoot ? '\r\n' : ''}`;
        }).join('\r\n');
    } else {
      result = String(data).toString();
    }

    return result;
  }

  static BTCRPC({
    // eslint-disable-next-line no-shadow
    protocol, port, hostname, path, data, user, password,
  }) {
    const basicAuth = this.base64Encode(`${user}:${password}`);
    const opt = {
      protocol,
      port,
      hostname,
      path,
      headers: { 'content-type': 'application/json', Authorization: `Basic ${basicAuth}` },
      data,
      timeout: 1000,
    };
    const start = new Date();
    return ecRequest.post(opt)
      .then((rs) => {
        let response = '';
        try {
          response = JSON.parse(rs.data);
        } catch (e) {
          this.logger.error(`BTCRPC(host: ${hostname} method:${data.method}), error: ${e.message}`);
          this.logger.error(`BTCRPC(host: ${hostname} method:${data.method}), rs.data.toString(): ${rs.data.toString()}`);
          return false;
        }
        this.logger.log(`RPC ${opt.hostname} method: ${opt.data.method} response time: ${new Date() - start}ms`);
        return Promise.resolve(response);
      })
      .catch((e) => {
        this.logger.log(`RPC ${opt.hostname} method: ${opt.data.method} response time: ${new Date() - start}ms`);
        throw e;
      });
  }

  static ETHRPC({
    // eslint-disable-next-line no-shadow
    protocol, port, hostname, path, data,
  }) {
    const opt = {
      protocol,
      port,
      hostname,
      path,
      headers: { 'content-type': 'application/json' },
      data,
      timeout: 1000,
    };
    const start = new Date();
    return ecRequest.post(opt)
      .then((rs) => {
        let response = '';
        try {
          response = JSON.parse(rs.data);
        } catch (e) {
          this.logger.error(`ETHRPC(host: ${hostname} method:${data.method}), error: ${e.message}`);
          this.logger.error(`ETHRPC(host: ${hostname} method:${data.method}), rs.data.toString(): ${rs.data.toString()}`);
          return e;
        }
        this.logger.log(`RPC ${opt.hostname} method: ${opt.data.method} response time: ${new Date() - start}ms`);
        return Promise.resolve(response);
      })
      .catch((e) => {
        this.logger.log(`RPC ${opt.hostname} method: ${opt.data.method} response time: ${new Date() - start}ms`);
        throw e;
      });
  }

  static initialAll({ configPath }) {
    const filePath = configPath || path.resolve(__dirname, '../../../private/config.toml');
    return this.readConfig({ filePath })
      .then((config) => {
        const rsConfig = config;
        // eslint-disable-next-line prefer-destructuring, prefer-rest-params
        rsConfig.argv = arguments[0];
        return this.initialFolder(config)
          .then(() => rsConfig);
      })
      .then((config) => Promise.all([
        config,
        initialORM(config),
        this.initialLogger(config),
        this.initialProcess(config),
      ]))
      .then((rs) => Promise.resolve({
        config: rs[0],
        database: {
          db: rs[1],
        },
        logger: rs[2],
      }))
      .catch(console.trace);
  }

  static readJSON({ filePath }) {
    return this.readFile({ filePath })
      .then((data) => JSON.parse(data));
  }

  static readFile({ filePath }) {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }

  static fileExists({ filePath }) {
    return new Promise((resolve) => {
      fs.access(filePath, fs.constants.F_OK, (err) => {
        resolve(!err);
      });
    });
  }

  static async readConfig({ filePath }) {
    let config; let defaultCFG; let
      currentCFG;

    const packageInfo = await this.readPackageInfo();
    const basePath = path.resolve(os.homedir(), packageInfo.name);
    const fileExists = await this.fileExists({ filePath });
    const defaultCFGP = path.resolve(__dirname, '../../../default.config.toml');
    const defaultCFGTOML = await this.readFile({ filePath: defaultCFGP });
    try {
      defaultCFG = toml.parse(defaultCFGTOML);
    } catch (e) {
      return Promise.reject(new Error(`Invalid config file: ${defaultCFGP}`));
    }

    if (!fileExists) {
      config = defaultCFG;
    } else {
      const currentCFGP = filePath;
      const currentCFGTOML = await this.readFile({ filePath: currentCFGP });
      try {
        currentCFG = toml.parse(currentCFGTOML);
      } catch (e) {
        return Promise.reject(new Error(`Invalid config file: ${currentCFGP}`));
      }
      config = dvalue.default(currentCFG, defaultCFG);
    }
    config.packageInfo = packageInfo;
    config.runtime = {
      filePath,
      startTime: new Date().getTime(),
    };
    config.homeFolder = config.base.folder
      ? path.resolve(basePath, config.base.folder)
      : basePath;
    return Promise.resolve(config);
  }

  static getConfig() {
    return JSON.parse(process.env.MERMER || '{}');
  }

  static readPackageInfo() {
    const filePath = path.resolve(__dirname, '../../../package.json');
    return this.readJSON({ filePath })
      .then((pkg) => {
        const packageInfo = {
          name: pkg.name,
          version: pkg.version,
          powerby: `${pkg.name} v${pkg.version}`,
        };
        return Promise.resolve(packageInfo);
      });
  }

  static listProcess() {
    return this.readPackageInfo()
      .then((packageInfo) => {
        const PIDFolder = path.resolve(os.homedir(), packageInfo.name, 'PIDs');
        this.scanFolder({ folder: PIDFolder })
          .then((list) => {
            const jobs = list
              .map((v) => parseInt(path.parse(v).name, 10))
              .filter((v) => v > -1)
              .sort((a, b) => (a > b
                ? 1
                : -1))
              .map((PID) => this.readProcess({ PID, PIDFolder }));

            return Promise.all(jobs)
              .then((d) => {
                const bar = new Array(20).fill('-').join('');
                console.log(`${bar}\r\n${d.join('\r\n')}\r\n${bar}`);
              });
          });
      });
  }

  static readProcess({ PID, PIDFolder = '' }) {
    return this.readPackageInfo()
      .then((packageInfo) => {
        PIDFolder = path.resolve(os.homedir(), packageInfo.name, 'PIDs');
        const PFile = path.resolve(PIDFolder, `${PID}.toml`);
        return Promise.resolve(PFile);
      })
      .then((PFile) => new Promise((resolve, reject) => {
        fs.readFile(PFile, (e, d) => {
          if (e) {
            reject(e);
          } else {
            let status;
            let uptime = '';
            const pInfo = toml.parse(d);
            const cPath = pInfo.runtime.configPath;
            if (this.testProcess({ PID })) {
              status = '\x1b[42m  on  \x1b[0m';
              uptime = this.parseTime(pInfo.runtime.startTime);
            } else {
              status = '\x1b[41m off  \x1b[0m';
              PID = `\x1b[90m${PID}\x1b[0m`;
              uptime = '\t';
            }
            resolve([PID, status, uptime, cPath].join('\t'));
          }
        });
      }));
  }

  static testProcess({ PID }) {
    try {
      process.kill(PID, 0);
      return true;
    } catch (e) {
      return false;
    }
  }

  static killProcess({ PID, pause }) {
    if (PID === 0) {
      return this.readPackageInfo()
        .then((packageInfo) => {
          const PIDFolder = path.resolve(os.homedir(), packageInfo.name, 'PIDs');
          return this.scanFolder({ folder: PIDFolder });
        })
        .then((list) => {
          const PIDs = list.map((PFile) => path.parse(PFile).name);
          return Promise.all(PIDs.map((pid) => this.killProcess({ PID: pid, pause })));
        });
    }

    try {
      process.kill(PID);
    // eslint-disable-next-line no-empty
    } catch (e) {

    }
    return this.readPackageInfo()
      .then((packageInfo) => {
        const fPID = path.resolve(os.homedir(), packageInfo.name, 'PIDs', `${PID}.toml`);
        return new Promise((resolve) => {
          if (pause) {
            resolve(true);
          } else {
            fs.unlink(fPID, resolve);
          }
        });
      });
  }

  static scanFolder({ folder }) {
    return new Promise((resolve, reject) => {
      fs.readdir(folder, (e, d) => {
        if (e) {
          reject(e);
        } else {
          resolve(d.map((v) => path.resolve(folder, v)));
        }
      });
    });
  }

  static initialFolder({ homeFolder }) {
    if (!homeFolder) {
      return Promise.reject(new Error('folder name is undefined'));
    }
    return new Promise((resolve, reject) => {
      fs.exists(homeFolder, (rs) => {
        if (!rs) {
          fs.mkdir(homeFolder, (e) => {
            if (e) {
              reject(e);
            } else {
              resolve(homeFolder);
            }
          });
        } else {
          resolve(homeFolder);
        }
      });
    });
  }

  static initialProcess(config) {
    const { packageInfo } = config;
    const processContent = Utils.toToml(config);
    const systemHome = path.resolve(os.homedir(), packageInfo.name);

    return new Promise((resolve, reject) => {
      const PID = process.pid;
      const pathPID = path.resolve(systemHome, 'PIDs', `${PID}.toml`);
      fs.writeFile(pathPID, processContent, (e) => {
        if (e) {
          reject(e);
        } else {
          resolve(true);
        }
      });
    });
  }

  static initialLevel({ homeFolder }) {
    const dbPath = path.resolve(homeFolder, 'dataset');
    return this.initialFolder({ homeFolder: dbPath })
      .then(() => level(dbPath, { valueEncoding: 'json' }));
  }

  static initialLogger({ base }) {
    log4js.configure({
      appenders: {
        out: {
          type: 'stdout',
        },
      },
      categories: {
        default: {
          appenders: ['out'],
          level: base.logLevel || 'debug',
        },
      },
    });
    this.loggerAdapter = log4js.getLogger('TideWallet');
    return Promise.resolve({
      log: (...data) => this.loggerAdapter.info('%s', data),
      error: (...data) => this.loggerAdapter.error('%s', data),
      debug: (...data) => this.loggerAdapter.debug('%s', data),
      trace: (...data) => this.loggerAdapter.trace('%s', data),
    });
  }

  static initiali18n() {
    // const localesFolder = path.resolve(__dirname, '../locales');
    return Promise.resolve(i18n);
  }

  static initialBots({
    // eslint-disable-next-line no-shadow
    config, database, logger, i18n,
  }) {
    const interfaceFN = 'Bot.js';
    this.config = config;
    this.database = database;
    this.logger = logger;
    this.databaseInstanceName = [];
    this.web3 = new Web3();

    Object.keys(database.db).forEach((item) => {
      this.databaseInstanceName.push(item);
    });

    this.defaultDBInstanceName = this.databaseInstanceName.findIndex((element) => element === 'cafeca') !== -1 ? 'cafeca' : this.databaseInstanceName[0];
    return this.scanFolder({ folder: __dirname })
      .then((list) => list.filter((v) => (path.parse(v).name !== path.parse(interfaceFN).name) && v.indexOf('.js') !== -1))
      // eslint-disable-next-line import/no-dynamic-require, global-require
      .then((list) => list.map((v) => require(v)))
      .then((list) => list.filter((v) => v.isBot))
      // eslint-disable-next-line new-cap
      .then((list) => list.map((v) => new v()))
      .then((list) => Promise.all(
        list.map((v) => v.init({
          config, database, logger, i18n,
        })),
      ));
  }

  static startBots({ Bots }) {
    return Promise.all(Bots.map((bot) => bot.start()))
      .then(() => Promise.all(Bots.map((bot) => bot.ready())))
      .then(() => Bots);
  }

  static close({ Bots }) {
    const { database } = Bots[0];
    database.mongodb.close();
    database.leveldb.close();
  }

  static crossOrigin(options = {}) {
    const defaultOptions = {
      allowMethods: ['GET', 'PUT', 'POST', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
    };

    // set defaultOptions to options
    options = { ...defaultOptions, ...options };

    // eslint-disable-next-line consistent-return
    return async function cors(ctx, next) {
      // always set vary Origin Header
      // https://github.com/rs/cors/issues/10
      ctx.vary('Origin');

      let origin;
      if (typeof options.origin === 'function') {
        origin = options.origin(ctx);
      } else {
        origin = options.origin || ctx.get('Origin') || '*';
      }
      if (!origin) {
        return next();
      }

      // Access-Control-Allow-Origin
      ctx.set('Access-Control-Allow-Origin', origin);

      if (ctx.method === 'OPTIONS') {
        // Preflight Request
        if (!ctx.get('Access-Control-Request-Method')) {
          return next();
        }

        // Access-Control-Max-Age
        if (options.maxAge) {
          ctx.set('Access-Control-Max-Age', String(options.maxAge));
        }

        // Access-Control-Allow-Credentials
        if (options.credentials === true) {
          // When used as part of a response to a preflight request,
          // this indicates whether or not the actual request can be made using credentials.
          ctx.set('Access-Control-Allow-Credentials', 'true');
        }

        // Access-Control-Allow-Methods
        if (options.allowMethods) {
          ctx.set('Access-Control-Allow-Methods', options.allowMethods.join(','));
        }

        // Access-Control-Allow-Headers
        if (options.allowHeaders) {
          ctx.set('Access-Control-Allow-Headers', options.allowHeaders.join(','));
        } else {
          ctx.set('Access-Control-Allow-Headers', ctx.get('Access-Control-Request-Headers'));
        }

        ctx.status = 204; // No Content
      } else {
        // Request
        // Access-Control-Allow-Credentials
        if (options.credentials === true) {
          if (origin === '*') {
            // `credentials` can't be true when the `origin` is set to `*`
            // -- ctx.remove('Access-Control-Allow-Credentials');
          } else {
            ctx.set('Access-Control-Allow-Credentials', 'true');
          }
        }

        // Access-Control-Expose-Headers
        if (options.exposeHeaders) {
          ctx.set('Access-Control-Expose-Headers', options.exposeHeaders.join(','));
        }

        await next();
      }
    };
  }

  static validateString(str) {
    return !(!str || typeof str !== 'string' || str.length <= 0);
  }

  static validateNumber(num) {
    if (!(/^(([\d]{1,18}(\.\d*)*)|(10{18}))$/.test(num)) || num < 0) {
      return false;
    }
    return true;
  }

  static async generateToken({ userID, data = {} }) {
    const tokenSecret = randToken.uid(256);
    const expireTime = new Date(new Date().getTime() + (Number(this.config.base.token_secret_expire_time) * 1000));

    const findOne = await this.database.db[this.defaultDBInstanceName].TokenSecret.findOrCreate({
      where: { user_id: userID },
      defaults: {
        tokenSecret, user_id: userID, expire_time: expireTime,
      },
    });

    if (!findOne[1]) {
      // update
      await this.database.db[this.defaultDBInstanceName].TokenSecret.update({
        tokenSecret, user_id: userID, expire_time: expireTime,
      },
      {
        where: { user_id: userID },
      });
    }

    return {
      token: JWT.sign({ userID, ...data }, this.config.jwt.secret, {
        expiresIn: this.config.base.token_secret_expire_time,
      }),
      tokenSecret,
      user_id: userID,
    };
  }

  static base64Encode(string) {
    const buf = Buffer.from(string);
    return buf.toString('base64');
  }

  static async verifyToken(token, ignoreExpiration = false) {
    try {
      const option = { ignoreExpiration };
      const data = JWT.verify(token, this.config.jwt.secret, option);

      const { userID } = data;
      const findUser = await this.database.db[this.defaultDBInstanceName].User.findOne({
        where: { user_id: userID },
      });

      if (!findUser) throw new ResponseFormat({ message: 'user not found', code: Codes.USER_NOT_FOUND });

      data.user = findUser;
      return data;
    } catch (err) {
      if (err.code === Codes.USER_NOT_FOUND) throw new ResponseFormat({ message: 'user not found', code: Codes.USER_NOT_FOUND });
      if (err.message === 'jwt expired') throw new ResponseFormat({ message: 'expired access token', code: Codes.EXPIRED_ACCESS_TOKEN });
      throw new ResponseFormat({ message: `server error(${err.message})`, code: Codes.SERVER_ERROR });
    }
  }

  static ripemd160(data) {
    const hash = crypto.createHash('ripemd160');
    hash.update(data);
    return hash.digest();
  }

  static sha256(message) {
    const hash = crypto.createHash('sha256');
    hash.update(message);
    return hash.digest();
  }

  static compressedPublicKey(uncomperedPublicKey) {
    if (typeof uncomperedPublicKey === 'string') uncomperedPublicKey = Buffer.from(uncomperedPublicKey, 'hex');
    if (uncomperedPublicKey.length % 2 === 1) {
      uncomperedPublicKey = uncomperedPublicKey.slice(1, uncomperedPublicKey.length);
    }

    const x = uncomperedPublicKey.slice(0, 32);
    const y = uncomperedPublicKey.slice(32, 64);

    const bnP = new BN('fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f', 16);

    const bnX = new BN(x.toString('hex'), 16);
    const bnY = new BN(y.toString('hex'), 16);

    const check = bnX.pow(new BN(3)).add(new BN(7)).sub((bnY.pow(new BN(2)))).mod(bnP);

    if (!check.isZero()) return 'Error';
    const prefix = bnY.isEven() ? '02' : '03';
    const compressed = Buffer.concat([Buffer.from(prefix, 'hex'), x]);

    return compressed;
  }

  static toP2pkhAddress(blockchainID, pubkey) {
    try {
      const _pubkey = pubkey.replace('0x', '');
      const fingerprint = this.ripemd160(this.sha256(_pubkey.length > 33 ? this.compressedPublicKey(_pubkey) : _pubkey));
      const findNetwork = Object.values(blockchainNetworks).find((value) => value.blockchain_id === blockchainID);
      const prefix = Buffer.from((findNetwork.pubKeyHash).toString(16).padStart(2, '0'), 'hex');
      const hashPubKey = Buffer.concat([prefix, fingerprint]);
      const address = bs58check.encode(hashPubKey);
      return address;
    } catch (e) {
      console.log('e', e);
      return e;
    }
  }

  static pubkeyToP2WPKHAddress(blockchainID, pubkey) {
    let address;
    if (blockchainID === '80000000') {
      const p2wpkh = bitcoin.payments.p2wpkh({ pubkey, network: bitcoin.networks.bitcoin });
      address = p2wpkh.address;
    } else if (blockchainID === '80000001') {
      const p2wpkh = bitcoin.payments.p2wpkh({ pubkey, network: bitcoin.networks.testnet });
      address = p2wpkh.address;
    }
    return address;
  }

  static toP2wpkhAddress(blockchainID, pubkey) {
    // Compressed Public Key to P2WPKH Address
    const address = this.pubkeyToP2WPKHAddress(blockchainID, pubkey);
    return address;
  }

  static is0xPrefixed(value) {
    return value.toString().slice(0, 2) === '0x';
  }

  static parse32BytesAddress(address) {
    if (typeof address !== 'string') return '';
    const parsedAddr = address.slice(-40);
    if (Utils.is0xPrefixed(address)) {
      return `0x${parsedAddr}`;
    }
    return parsedAddr;
  }

  static async ethGetBalanceByAddress(blockchain_id, address, decimals = 18) {
    const blockchainConfig = this.getBlockchainConfig(blockchain_id);
    if (!blockchainConfig) throw new ResponseFormat({ message: 'blockchain_id not found', code: Codes.BLOCKCHAIN_ID_NOT_FOUND });

    const option = { ...blockchainConfig };
    option.data = {
      jsonrpc: '2.0',
      method: 'eth_getBalance',
      params: [address, 'pending'],
      id: dvalue.randomID(),
    };

    const checkId = option.data.id;
    const data = await this.ETHRPC(option);
    if (data instanceof Object) {
      if (data.id === checkId) {
        // use address find account
        try {
          if (!data.result) return '0';
          return new BigNumber(data.result).dividedBy(new BigNumber(10 ** decimals)).toFixed();

          // eslint-disable-next-line no-empty
        } catch (e) {
          return '0';
        }
      }
    }
  }

  static async getERC20Token(blockchain_id, address, contract, decimals = 18) {
    const _address = address.replace('0x', '').padStart(64, '0');
    const command = `0x70a08231${_address}`;

    const blockchainConfig = this.getBlockchainConfig(blockchain_id);
    if (!blockchainConfig) throw new ResponseFormat({ message: 'blockchain_id not found', code: Codes.BLOCKCHAIN_ID_NOT_FOUND });
    const option = { ...blockchainConfig };
    option.data = {
      jsonrpc: '2.0',
      method: 'eth_call',
      params: [{
        to: contract,
        data: command,
      },
      'latest'],
      id: dvalue.randomID(),
    };

    const checkId = option.data.id;
    const data = await this.ETHRPC(option);
    if (data instanceof Object) {
      if (data.id === checkId) {
        // use address find account
        try {
          return new BigNumber(data.result).dividedBy(new BigNumber(10 ** decimals)).toFixed();

          // eslint-disable-next-line no-empty
        } catch (e) {
          return '0';
        }
      }
    }
  }

  static dividedByDecimal(amount, decimal) {
    if (typeof decimal === 'undefined' || decimal === null) return '0';
    let _amount = (amount instanceof BigNumber) ? amount : new BigNumber(amount);
    if (typeof amount === 'string' && (amount).indexOf('0x') !== -1) _amount = new BigNumber(amount, 16);
    return _amount.dividedBy(new BigNumber(10 ** decimal)).toFixed();
  }

  static multipliedByDecimal(amount, decimal) {
    if (typeof decimal === 'undefined' || decimal === null) return '8';
    let _amount = (amount instanceof BigNumber) ? amount : new BigNumber(amount);
    if (typeof amount === 'string' && (amount).indexOf('0x') !== -1) _amount = new BigNumber(amount, 16);
    return _amount.multipliedBy(new BigNumber(10 ** decimal)).toFixed();
  }

  static getBlockchainConfig(blockchain_id) {
    return Object.values(this.config.blockchain).find((info) => info.blockchain_id === blockchain_id) || false;
  }

  static hash160(data) {
    return this.ripemd160(this.sha256(data));
  }

  static pubkeyToBIP49RedeemScript(compressedPubKey) {
    const rs = [0x00, 0x14];
    rs.push(...this.hash160(compressedPubKey));
    return Buffer.from(rs);
  }

  static pubkeyToP2SHAddress(type, compressedPubKey) {
    const redeemScript = this.pubkeyToBIP49RedeemScript(compressedPubKey);
    const fingerprint = this.hash160(redeemScript);
    // List<int> checksum = sha256(sha256(fingerprint)).sublist(0, 4);
    // bs58check library 會幫加checksum
    const address = bs58check.encode(Uint8Array.from([type.p2shAddressPrefix, ...fingerprint]));
    return address;
  }

  static formatAddressArray(addresses) {
    if (typeof addresses === 'string') {
      try {
        addresses = JSON.parse(addresses);
      } catch (e) {
        // if is eth address: '0x123456789...' JSON.parse will panic, only return string
        return addresses;
      }
    }
    let result = [];
    addresses.forEach((addressItem) => {
      if (Array.isArray(addressItem.addresses)) {
        result = result.concat(addressItem.addresses);
      } else {
        result.push(addressItem.addresses);
      }
    });

    return result.join();
  }

  static randomStr(length) {
    let key = '';
    const charset = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i = 0; i < length; i++) { key += charset.charAt(Math.floor(Math.random() * charset.length)); }
    return key;
  }

  static async getTokenNameFromPeer(options, address) {
    try {
      const command = '0x06fdde03'; // erc20 get name
      options.data = {
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{
          to: address,
          data: command,
        }, 'latest'],
        id: dvalue.randomID(),
      };
      const checkId = options.data.id;
      const data = await Utils.ETHRPC(options);
      if (data instanceof Object) {
        if (data.id !== checkId) {
          this.logger.error('getTokenNameFromPeer fail');
          return null;
        }
        if (data.result) {
          const nameEncode = data.result;
          if (nameEncode.length !== 194) return nameEncode;
          const name = this.web3.eth.abi.decodeParameter('string', nameEncode);
          return Promise.resolve(name);
        }
      }
      this.logger.error(`getTokenNameFromPeer(${address}) fail, ${JSON.stringify(data.error)}`);
      return null;
    } catch (error) {
      console.log(error);
      this.logger.error(`getTokenNameFromPeer(${address}) error: ${error}`);
      return null;
    }
  }

  static async getTokenSymbolFromPeer(options, address) {
    try {
      const command = '0x95d89b41'; // erc20 get synbol
      options.data = {
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{
          to: address,
          data: command,
        }, 'latest'],
        id: dvalue.randomID(),
      };
      const checkId = options.data.id;
      const data = await Utils.ETHRPC(options);
      if (data instanceof Object) {
        if (data.id !== checkId) {
          this.logger.error('getTokenSymbolFromPeer fail');
          return null;
        }
        if (data.result) {
          const symbolEncode = data.result;
          if (symbolEncode.length !== 194) return symbolEncode;
          const symbol = this.web3.eth.abi.decodeParameter('string', symbolEncode);
          return Promise.resolve(symbol);
        }
      }
      this.logger.error(`getTokenSymbolFromPeer(${address}) fail, ${JSON.stringify(data.error)}`);
      return null;
    } catch (error) {
      this.logger.error(`getTokenSymbolFromPeer(${address}) error: ${error}`);
      return null;
    }
  }

  static async getTokenDecimalFromPeer(options, address) {
    try {
      const command = '0x313ce567'; // erc20 get decimals
      options.data = {
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{
          to: address,
          data: command,
        }, 'latest'],
        id: dvalue.randomID(),
      };
      const checkId = options.data.id;
      const data = await Utils.ETHRPC(options);
      if (data instanceof Object) {
        if (data.id !== checkId) {
          this.logger.error('getTokenDecimalFromPeer fail');
          return null;
        }
        const decimals = data.result;
        if (data.result) { return Promise.resolve(parseInt(decimals, 16)); }
      }
      this.logger.error(`getTokenDecimalFromPeer(${address}) fail, ${JSON.stringify(data.error)}`);
      return null;
    } catch (error) {
      this.logger.error(`getTokenDecimalFromPeer(${address}) error: ${error}`);
      return null;
    }
  }

  static async getTokenTotalSupplyFromPeer(options, address) {
    try {
      const command = '0x18160ddd'; // erc20 get total supply
      options.data = {
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{
          to: address,
          data: command,
        }, 'latest'],
        id: dvalue.randomID(),
      };
      const checkId = options.data.id;
      const data = await Utils.ETHRPC(options);
      if (data instanceof Object) {
        if (data.id !== checkId) {
          this.logger.error('getTokenTotalSupplyFromPeer fail');
          return null;
        }
        if (data.result) {
          const bnTotalSupply = new BigNumber(data.result, 16);
          return Promise.resolve(bnTotalSupply.toFixed());
        }
      }
      this.logger.error(`getTokenTotalSupplyFromPeer(${address}) fail, ${JSON.stringify(data.error)}`);
      return null;
    } catch (error) {
      this.logger.error(`getTokenTotalSupplyFromPeer(${address}) error: ${error}`);
      return null;
    }
  }

  static async ethGetBlockByNumber(option, blockHeight) {
    option.data = {
      jsonrpc: '2.0',
      method: 'eth_getBlockByNumber',
      params: [`0x${(blockHeight).toString(16)}`, false],
      id: dvalue.randomID(),
    };
    const rs = await this.ETHRPC(option);
    if (rs && rs.result && rs.result.number !== null) return rs;
    return null;
  }

  static async getETHTps(blockchain_id, blockHeight) {
    const blockchainConfig = this.getBlockchainConfig(blockchain_id);
    if (!blockchainConfig) throw new ResponseFormat({ message: 'blockchain_id not found', code: Codes.BLOCKCHAIN_ID_NOT_FOUND });
    const option = { ...blockchainConfig };

    const findAllTxs = await Promise.all([
      this.ethGetBlockByNumber(option, blockHeight),
      this.ethGetBlockByNumber(option, blockHeight - 1),
      this.ethGetBlockByNumber(option, blockHeight - 2),
    ]).catch((error) => new ResponseFormat({ message: `rpc error(${error})`, code: Codes.RPC_ERROR }));
    if (findAllTxs.code === Codes.RPC_ERROR) return 0;

    const timeTaken = findAllTxs[0].result.timestamp - findAllTxs[2].result.timestamp;
    const transactionCount = findAllTxs.reduce((prev, curr) => {
      const prevLen = (prev.result) ? prev.result.transactions.length : prev.len;
      return { len: prevLen + curr.result.transactions.length };
    }, { len: 0 });
    const tps = transactionCount.len / timeTaken;
    return tps.toFixed(2);
  }

  static async btcGetBlockByNumber(option, blockHeight) {
    option.data = {
      jsonrpc: '1.0',
      method: 'getblockstats',
      params: [blockHeight, ['time', 'txs']],
      id: dvalue.randomID(),
    };
    const rs = await this.BTCRPC(option);
    if (rs && rs.result && rs.result.number !== null) return rs;
    return null;
  }

  static async getBTCTps(blockchain_id, blockHeight) {
    const blockchainConfig = this.getBlockchainConfig(blockchain_id);
    if (!blockchainConfig) throw new ResponseFormat({ message: 'blockchain_id not found', code: Codes.BLOCKCHAIN_ID_NOT_FOUND });
    const option = { ...blockchainConfig };

    const findAllTxs = await Promise.all([
      this.btcGetBlockByNumber(option, blockHeight),
      this.btcGetBlockByNumber(option, blockHeight - 1),
      this.btcGetBlockByNumber(option, blockHeight - 2),
    ]).catch((error) => new ResponseFormat({ message: `rpc error(${error})`, code: Codes.RPC_ERROR }));
    if (findAllTxs.code === Codes.RPC_ERROR) return 0;

    const timeTaken = findAllTxs[0].result.time - findAllTxs[2].result.time;
    const transactionCount = findAllTxs.reduce((prev, curr) => {
      if (prev.result)console.log(prev.result.txs);
      const prevLen = (prev.result) ? prev.result.txs : prev.len;
      return { len: prevLen + curr.result.txs };
    }, { len: 0 });
    const tps = transactionCount.len / timeTaken;
    return tps.toFixed(2);
  }

  static blockchainIDToDBName(blockchainID) {
    const { db_name } = Utils.blockchainIDToBlockInfo(blockchainID);
    return db_name;
  }

  static blockchainIDToNetworkID(blockchainID) {
    const { network_id } = Utils.blockchainIDToBlockInfo(blockchainID);
    return network_id;
  }

  static blockchainIDToBlockInfo(blockchainID) {
    const networks = Object.values(blockchainNetworks);
    const findIndex = networks.findIndex((item) => item.blockchain_id === blockchainID);
    if (findIndex === -1) throw new ResponseFormat({ message: 'blockchain id not found', code: Codes.BLOCKCHAIN_ID_NOT_FOUND });
    return networks[findIndex];
  }

  static formatIconUrl(iconUrl) {
    const host = this.config.base.domain ? this.config.base.domain : '';
    return iconUrl.replace('/undefined//i', host);
  }
}

module.exports = Utils;
