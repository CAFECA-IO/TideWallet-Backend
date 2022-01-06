const Bot = require('./Bot');
const ResponseFormat = require('./ResponseFormat');
const Code = require('./Codes');
const Utils = require('./Utils');

class Enterprise extends Bot {
  constructor() {
    super();
    this.name = 'Enterprise';
    this._crawlerManagers = [];
  }

  init({
    config, database, logger, i18n,
  }) {
    return super
      .init({
        config,
        database,
        logger,
        i18n,
      })
      .then(() => this);
  }

  start() {
    return super.start().then(() => this);
  }

  async apiKey({ body }) {
    const { name, project } = body;
    if (!name || !project) {
      return new ResponseFormat({
        message: 'invalid input',
        code: Code.INVALID_INPUT,
      });
    }
    const apiKey = Utils.base64Encode(Utils.sha256(Utils.sha256(`${name}_${project}`)).toString('hex')).slice(0, 32);
    return new ResponseFormat({
      message: 'Regist Api Key',
      payload: {
        apiKey,
      },
    });
  }
}

module.exports = Enterprise;
