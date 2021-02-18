const mockTokenTransaction = [{
  addressTokenTransaction_id: 'a9325f90-6a5e-40fa-8e06-7efa276e3222',
  currency_id: '5b1ea92e584bf50020130617',
  accountAddress_id: '0b72df67-7b6a-4b1a-abda-c91b56be5d11',
  tokenTransaction_id: 'a9325f90-6a5e-40fa-8e06-7efa276e3212',
  direction: 1,
}];

module.exports = {
  up: (queryInterface) => queryInterface.bulkInsert('AddressTokenTransaction', mockTokenTransaction, { ignoreDuplicates: true }),
  down: (queryInterface, Sequelize) => queryInterface.bulkDelete('AddressTokenTransaction', {
    [Sequelize.Op.or]: mockTokenTransaction.filter((item) => ({ tokenTransaction_id: item.tokenTransaction_id })),
  }, {}),
};
