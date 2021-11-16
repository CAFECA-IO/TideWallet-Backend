module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      queryInterface.addConstraint('AddressTransaction', {
        name: 'unique_constraint_currency_id_transaction_id_direction_address',
        type: 'unique',
        fields: ['currency_id', 'transaction_id', 'direction', 'address'],
      });
      return Promise.resolve();
    } catch (e) {
      console.log(e);
      return Promise.resolve();
    }
  },
  async down(queryInterface, Sequelize) {
    try {
      queryInterface.removeConstraint('AddressTransaction', 'unique_constraint_currency_id_transaction_id_direction_address');
      return Promise.resolve();
    } catch (e) {
      console.log(e);
      return Promise.resolve();
    }
  },
};
