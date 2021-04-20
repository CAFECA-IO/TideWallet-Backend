module.exports = {
  up: (queryInterface, Sequelize) => Promise.all([
    queryInterface.addColumn(
      'BlockScanned',
      'miner',
      {
        type: Sequelize.STRING,
      },
    ),
    queryInterface.addColumn(
      'BlockScanned',
      'difficulty',
      {
        type: Sequelize.STRING,
      },
    ),
    queryInterface.addColumn(
      'BlockScanned',
      'transactions_root',
      {
        type: Sequelize.STRING,
      },
    ),
    queryInterface.addColumn(
      'BlockScanned',
      'size',
      {
        type: Sequelize.BIGINT,
      },
    ),
    queryInterface.addColumn(
      'BlockScanned',
      'transaction_volume',
      {
        type: Sequelize.STRING,
      },
    ),
    queryInterface.addColumn(
      'BlockScanned',
      'gas_used',
      {
        type: Sequelize.BIGINT,
      },
    ),
    queryInterface.addColumn(
      'BlockScanned',
      'block_reward',
      {
        type: Sequelize.STRING,
      },
    ),
    queryInterface.addColumn(
      'BlockScanned',
      'block_fee',
      {
        type: Sequelize.STRING,
      },
    ),
    queryInterface.addColumn(
      'BlockScanned',
      'extra_data',
      {
        type: Sequelize.STRING,
      },
    ),
  ]).catch((e) => Promise.resolve(e)),
  down: (queryInterface, Sequelize) => Promise.all([
    queryInterface.removeColumn('BlockScanned', 'miner'),
    queryInterface.removeColumn('BlockScanned', 'difficulty'),
    queryInterface.removeColumn('BlockScanned', 'transactions_root'),
    queryInterface.removeColumn('BlockScanned', 'size'),
    queryInterface.removeColumn('BlockScanned', 'transaction_volume'),
    queryInterface.removeColumn('BlockScanned', 'gas_used'),
    queryInterface.removeColumn('BlockScanned', 'block_reward'),
    queryInterface.removeColumn('BlockScanned', 'block_fee'),
    queryInterface.removeColumn('BlockScanned', 'extra_data'),

  ]).catch((e) => Promise.resolve(e)),
};
