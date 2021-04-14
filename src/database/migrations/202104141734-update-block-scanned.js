module.exports = {
  up: (queryInterface, Sequelize) => Promise.all([
    queryInterface.addColumn(
      'BlockScanned',
      'transaction_count',
      {
        type: Sequelize.INTEGER,
      },
    ),
    queryInterface.addIndex(
      'BlockScanned',
      ['blockchain_id', 'timestamp'],
    ),
  ]).catch((e) => Promise.resolve(e)),
  down: (queryInterface, Sequelize) => Promise.all([
    queryInterface.removeIndex(
      'BlockScanned',
      ['blockchain_id', 'timestamp'],
    ),
    queryInterface.removeColumn('BlockScanned', 'transaction_count'),

  ]).catch((e) => Promise.resolve(e)),
};
