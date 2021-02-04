const Codes = {
  // No Error
  SUCCESS: '00000000',

  // Input Error 01000000 - 01009999

  // Condition Error 02000000 - 02009999

  // Authorization Error 03000000 - 03009999

  // Resource Not Found Error 04000000 - 04009999
  BLOCKCHAIN_ID_NOT_FOUND: '04000000',
  CURRENCY_ID_NOT_FOUND: '04000001',

  // Processing Error (Caught Exception) 05000000 - 05009999
  DB_ERROR: '05000000',

  // Uncaught Exception or Unknown Error 09000000
  UNKNOWN_ERROR: '09000000',
};

module.exports = Codes;
