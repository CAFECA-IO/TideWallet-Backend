module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.addColumn(
        'AddressTransaction',
        'address',
        {
          type: Sequelize.STRING,
          defaultValue: '',
        },
      );
      return Promise.resolve();
    } catch (e) {
      console.log(e);
      return Promise.reject(e);
    }
  },
  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.removeColumn('AddressTransaction', 'address');
      return Promise.resolve();
    } catch (e) {
      console.log(e);
      return Promise.resolve(e);
    }
  },
};
