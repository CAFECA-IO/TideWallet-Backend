const pjson = require('../../../package.json');
const Codes = require('./Codes');

class ResponseFormat extends Error {
  constructor({ code = Codes.SUCCESS, message, payload = {} }) {
    super();

    return {
      powerby: `TideWallet API ${pjson.version}`,
      success: true,
      code,
      message,
      payload,
    };
  }
}

module.exports = ResponseFormat;
