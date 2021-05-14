module.exports = {
  up: (queryInterface, Sequelize) => new Promise((resolve, reject) => {
    try {
      queryInterface.addIndex(
        'UnparsedTransaction',
        ['blockchain_id', 'timestamp'],
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
        'UnparsedTransaction',
        ['blockchain_id', 'timestamp'],
      );
    } catch (e) {
      reject(e);
    }
    resolve();
  }),
};
