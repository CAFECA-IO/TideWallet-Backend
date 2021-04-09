module.exports = {
  up: (queryInterface, Sequelize) => new Promise((resolve, reject) => {
    try {
      queryInterface.addIndex(
        'Receipt',
        ['currency_id', 'transaction_id'],
        {
          unique: true,
        },
      );
    } catch (e) {
      reject(e);
    }
    resolve();
  }),
  down: async (queryInterface, Sequelize) => new Promise((resolve, reject) => {
    try {
      queryInterface.removeIndex(
        'Receipt',
        ['currency_id', 'transaction_id'],
      );
    } catch (e) {
      reject(e);
    }
    resolve();
  }),
};
