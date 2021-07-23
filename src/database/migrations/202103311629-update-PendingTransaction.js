module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.addColumn(
        'PendingTransaction',
        'blockAsked',
        {
          type: Sequelize.INTEGER,
        },
      );
      await queryInterface.addIndex(
        'PendingTransaction',
        ['blockchain_id', 'blockAsked'],
        {
          unique: false,
        },
      );
      return Promise.resolve();
    } catch (e) {
      console.log(e);
      return Promise.resolve();
    }
  },
  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.removeIndex(
        'PendingTransaction',
        ['blockchain_id', 'blockAsked'],
      );
      await queryInterface.removeColumn('PendingTransaction', 'blockAsked');
      return Promise.resolve();
    } catch (e) {
      console.log(e);
      return Promise.resolve();
    }
  },
};
