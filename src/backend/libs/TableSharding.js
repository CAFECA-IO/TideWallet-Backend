const { DataTypes } = require('sequelize');
const UnparsedTransaction = require('../../database/models/UnparsedTransaction');

// ++ not complete
class TableSharding {
  constructor(sequelize, bcid) {
    this.sequelize = sequelize;
    this.bcid = bcid;
    this.models = {
      UnparsedTransaction,
    };
  }

  sharding() {
    const res = {};
    const modelsName = Object.keys(this.models);
    for (const model of modelsName) {
      res[model] = this.models[model](this.sequelize, DataTypes, this.bcid);
    }
    return res;
  }
}

module.exports = TableSharding;
