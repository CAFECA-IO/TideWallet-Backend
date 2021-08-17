module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.addIndex(
        'AddressTransaction',
        ['address'],
        {
          unique: false,
        },
      );
      await queryInterface.addIndex(
        'AddressTransaction',
        ['accountAddress_id'],
        {
          unique: false,
        },
      );
      return Promise.resolve();
    } catch (e) {
      console.log(e);
      return Promise.reject(e);
      // return Promise.resolve(e);
    }
  },
  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.removeIndex('AddressTransaction', ['address']);
      await queryInterface.removeIndex('AddressTransaction', ['accountAddress_id']);
      return Promise.resolve();
    } catch (e) {
      console.log(e);
      return Promise.resolve(e);
    }
  },
};
