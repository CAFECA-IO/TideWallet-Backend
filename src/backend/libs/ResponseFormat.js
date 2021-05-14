const pjson = require('../../../package.json');
const Codes = require('./Codes');

class ResponseFormat extends Error {
  constructor({
    code = Codes.SUCCESS, message, payload = {}, items, meta,
  }) {
    super();

    if (items && meta) {
      payload = {
        items,
        meta,
      };
    }
    return {
      powerby: `TideWallet API ${pjson.version}`,
      success: code === Codes.SUCCESS,
      code,
      message,
      payload,
    };
  }
}

module.exports = ResponseFormat;
