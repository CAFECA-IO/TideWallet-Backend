module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      queryInterface.addConstraint('AddressTokenTransaction', {
        name: 'unique_constraint_currency_id_tokenTransaction_id_direction_address',
        type: 'unique',
        fields: ['currency_id', 'tokenTransaction_id', 'direction', 'address'],
      });
      return Promise.resolve();
    } catch (e) {
      console.log(e);
      return Promise.resolve();
    }
  },
  async down(queryInterface, Sequelize) {
    try {
      queryInterface.removeConstraint('AddressTokenTransaction', 'unique_constraint_currency_id_tokenTransaction_id_direction_address');
      return Promise.resolve();
    } catch (e) {
      console.log(e);
      return Promise.resolve();
    }
  },
};
