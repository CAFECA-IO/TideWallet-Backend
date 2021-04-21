module.exports = {
  up: (queryInterface, Sequelize) => new Promise((resolve, reject) => {
    try {
      queryInterface.addIndex(
        'Transaction',
        ['currency_id', 'block'],
        {
          unique: false,
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
        'Transaction',
        ['currency_id', 'block'],
      );
    } catch (e) {
      reject(e);
    }
    resolve();
  }),
};
