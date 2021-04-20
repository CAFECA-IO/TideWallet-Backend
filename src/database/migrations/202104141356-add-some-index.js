module.exports = {
  up: (queryInterface, Sequelize) => new Promise((resolve, reject) => {
    try {
      queryInterface.addIndex(
        'TokenTransaction',
        ['transaction_id'],
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
        'TokenTransaction',
        ['transaction_id'],
      );
    } catch (e) {
      reject(e);
    }
    resolve();
  }),
};
