module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.renameColumn(
        'AccountAddress',
        'chain_index',
        'change_index',
      );
      return Promise.resolve();
    } catch (e) {
      console.log(e);
      return Promise.resolve();
    }
  },
  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.renameColumn(
        'AccountAddress',
        'change_index',
        'chain_index',
      );
      return Promise.resolve();
    } catch (e) {
      console.log(e);
      return Promise.resolve();
    }
  },
};
