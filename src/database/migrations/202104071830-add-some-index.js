module.exports = {
  up: (queryInterface, Sequelize) => new Promise((resolve, reject) => {
    try {
      queryInterface.addIndex(
        'BlockScanned',
        ['blockchain_id', 'block'],
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
        'BlockScanned',
        ['blockchain_id', 'block'],
      );
    } catch (e) {
      reject(e);
    }
    resolve();
  }),
};
