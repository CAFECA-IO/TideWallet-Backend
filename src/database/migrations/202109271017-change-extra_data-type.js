module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      queryInterface.changeColumn('BlockScanned', 'extra_data', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
      return Promise.resolve();
    } catch (e) {
      console.log(e);
      return Promise.resolve();
    }
  },
  async down(queryInterface, Sequelize) {
    try {
      queryInterface.changeColumn('BlockScanned', 'extra_data', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      return Promise.resolve();
    } catch (e) {
      console.log(e);
      return Promise.resolve();
    }
  },
};
