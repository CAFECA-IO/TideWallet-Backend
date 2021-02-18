const mockAddressTransaction = [{
  addressTransaction_id: 'a9325f90-6a5e-40fa-8e06-7efa276ebbbb',
  currency_id: '5b1ea92e584bf50020130612',
  accountAddress_id: '24aeabce-a0fa-4813-9fa1-2280ad50b9c5',
  transaction_id: 'a9325f90-6a5e-40fa-8e06-7efa276eaaaa',
  direction: 0,
}, {
  addressTransaction_id: 'a9325f90-6a5e-40fa-8e06-7efa276edddd',
  currency_id: '5b1ea92e584bf50020130612',
  accountAddress_id: '89c385bc-1183-4ee1-af71-14f5110ae71d',
  transaction_id: 'a9325f90-6a5e-40fa-8e06-7efa276ecccc',
  direction: 0,
}, {
  addressTransaction_id: 'a9325f90-6a5e-40fa-8e06-7efa276effff',
  currency_id: '5b1ea92e584bf50020130612',
  accountAddress_id: '89c385bc-1183-4ee1-af71-14f5110ae71d',
  transaction_id: 'a9325f90-6a5e-40fa-8e06-7efa276eeeee',
  direction: 0,
}, {
  addressTransaction_id: 'a9325f90-6a5e-40fa-8e06-7efa276e3212',
  currency_id: '5b1ea92e584bf50020130617',
  accountAddress_id: '9dd280ea-dec3-4442-801f-c2ba6acfc207',
  transaction_id: 'a9325f90-6a5e-40fa-8e06-7efa276e1234',
  direction: 0,
}];

module.exports = {
  up: (queryInterface) => queryInterface.bulkInsert('AddressTransaction', mockAddressTransaction, { ignoreDuplicates: true }),
  down: (queryInterface, Sequelize) => queryInterface.bulkDelete('AddressTransaction', {
    [Sequelize.Op.or]: mockAddressTransaction.filter((item) => ({ addressTransaction_id: item.addressTransaction_id })),
  }, {}),
};
