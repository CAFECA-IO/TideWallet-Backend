module.exports = {
  up: (queryInterface, Sequelize) => new Promise((resolve, reject) => {
    try {
      queryInterface.renameColumn(
        'AccountAddress',
        'chain_index',
        'change_index',
      );
    } catch (e) {
      reject(e);
    }
    resolve();
  }),
  down: async (queryInterface, Sequelize) => new Promise((resolve, reject) => {
    try {
      queryInterface.renameColumn(
        'AccountAddress',
        'change_index',
        'chain_index',
      );
    } catch (e) {
      reject(e);
    }
    resolve();
  }),
};
