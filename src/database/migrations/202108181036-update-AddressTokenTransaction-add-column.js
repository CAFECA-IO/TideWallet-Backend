module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.addColumn(
        'AddressTokenTransaction',
        'address',
        {
          type: Sequelize.STRING,
          defaultValue: '',
        },
      );
      return Promise.resolve();
    } catch (e) {
      console.log(e);
      return Promise.resolve(e);
    }
  },
  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.removeColumn('AddressTokenTransaction', 'address');
      return Promise.resolve();
    } catch (e) {
      console.log(e);
      return Promise.resolve(e);
    }
  },
};
