module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.removeConstraint('AddressTransaction',
        'AddressTransaction_accountAddress_id_fkey');
      return Promise.resolve();
    } catch (e) {
      console.log(e);
      // return Promise.reject(e);
      return Promise.resolve(e);
    }
  },
  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.addConstraint('AddressTransaction', {
        fields: ['accountAddress_id'],
        type: 'foreign key',
        name: 'AddressTransaction_accountAddress_id_fkey',
        references: { // Required field
          table: 'AccountAddress',
          field: 'accountAddress_id',
        },
        onUpdate: 'cascade',
      });
      return Promise.resolve();
    } catch (e) {
      console.log(e);
      return Promise.resolve(e);
    }
  },
};
