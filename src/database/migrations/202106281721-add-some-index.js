module.exports = {
  up: (queryInterface, Sequelize) => new Promise((resolve, reject) => {
    try {
      queryInterface.addIndex(
        'FiatCurrencyRate',
        ['currency_id'],
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
        'FiatCurrencyRate',
        ['currency_id'],
      );
    } catch (e) {
      reject(e);
    }
    resolve();
  }),
};
