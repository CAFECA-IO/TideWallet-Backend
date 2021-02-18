const mockAddressTransaction = [{
  addressTransaction_id: 'a9325f90-6a5e-40fa-8e06-7efa276ebbbb',
  currency_id: '5b1ea92e584bf50020130612',
  accountAddress_id: '0b72df67-7b6a-4b1a-abda-c91b56be5d11',
  transaction_id: 'a9325f90-6a5e-40fa-8e06-7efa276eaaaa',
  direction: 0,
}, {
  addressTransaction_id: 'a9325f90-6a5e-40fa-8e06-7efa276edddd',
  currency_id: '5b1ea92e584bf50020130612',
  accountAddress_id: 'cd5cb844-4fb0-4b24-8c25-f1db74ba5bf4',
  transaction_id: 'a9325f90-6a5e-40fa-8e06-7efa276ecccc',
  direction: 0,
}, {
  addressTransaction_id: 'a9325f90-6a5e-40fa-8e06-7efa276effff',
  currency_id: '5b1ea92e584bf50020130612',
  accountAddress_id: 'cd5cb844-4fb0-4b24-8c25-f1db74ba5bf4',
  transaction_id: 'a9325f90-6a5e-40fa-8e06-7efa276eeeee',
  direction: 0,
}, {
  addressTransaction_id: 'a9325f90-6a5e-40fa-8e06-7efa276e3212',
  currency_id: '5b1ea92e584bf50020130617',
  accountAddress_id: 'cd5cb844-4fb0-4b24-8c25-f1db74ba5bf4',
  transaction_id: 'a9325f90-6a5e-40fa-8e06-7efa276e1234',
  direction: 0,
}];

module.exports = {
  up: (queryInterface) => queryInterface.bulkInsert('AddressTransaction', mockAddressTransaction, { ignoreDuplicates: true }),
  down: (queryInterface, Sequelize) => queryInterface.bulkDelete('AddressTransaction', {
    [Sequelize.Op.or]: mockAddressTransaction.filter((item) => ({ addressTransaction_id: item.addressTransaction_id })),
  }, {}),
};
