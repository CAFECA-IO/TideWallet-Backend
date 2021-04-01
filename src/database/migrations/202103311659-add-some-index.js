module.exports = {
  up: (queryInterface, Sequelize) => Promise.all([
    queryInterface.addIndex(
      'Transaction',
      ['currency_id', 'result'],
      {
        unique: false,
      },
    ),
    queryInterface.addIndex(
      'TokenTransaction',
      ['currency_id', 'transaction_id'],
      {
        unique: false,
      },
    ),
  ]).catch((e) => Promise.resolve(e)),
  down: (queryInterface, Sequelize) => Promise.all([
    queryInterface.removeIndex(
      'TokenTransaction',
      ['currency_id', 'transaction_id'],
    ),
    queryInterface.removeIndex(
      'Transaction',
      ['currency_id', 'result'],
    ),
  ]).catch((e) => Promise.resolve(e)),
};
