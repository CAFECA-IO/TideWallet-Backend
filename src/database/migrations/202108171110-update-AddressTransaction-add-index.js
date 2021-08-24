module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.addIndex(
        'AddressTransaction',
        ['currency_id', 'address'],
        {
          unique: false,
        },
      );
      await queryInterface.addIndex(
        'AddressTransaction',
        ['currency_id', 'accountAddress_id'],
        {
          unique: false,
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
      await queryInterface.removeIndex('AddressTransaction', ['currency_id', 'address']);
      await queryInterface.removeIndex('AddressTransaction', ['currency_id', 'accountAddress_id']);
      return Promise.resolve();
    } catch (e) {
      console.log(e);
      return Promise.resolve(e);
    }
  },
};
