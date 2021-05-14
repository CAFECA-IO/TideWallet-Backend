module.exports = {
  up: (queryInterface, Sequelize) => new Promise((resolve, reject) => {
    try {
      queryInterface.addColumn(
        'PendingTransaction',
        'blockAsked',
        {
          type: Sequelize.INTEGER,
        },
      );
    } catch (e) {
      reject(e);
    }
    resolve();
  }).then(() => new Promise((resolve, reject) => {
    try {
      queryInterface.addIndex(
        'PendingTransaction',
        ['blockchain_id', 'blockAsked'],
        {
          unique: false,
        },
      );
    } catch (e) {
      reject(e);
    }
    resolve();
  })),
  down: (queryInterface, Sequelize) => new Promise((resolve, reject) => {
    try {
      queryInterface.removeIndex(
        'PendingTransaction',
        ['blockchain_id', 'blockAsked'],
      );
    } catch (e) {
      reject(e);
    }
    resolve();
  }).then(() => new Promise((resolve, reject) => {
    try {
      queryInterface.removeColumn('PendingTransaction', 'blockAsked');
    } catch (e) {
      reject(e);
    }
    resolve();
  })),
};
