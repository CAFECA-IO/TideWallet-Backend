const mockTokenTransaction = [{
  tokenTransaction_id: 'a9325f90-6a5e-40fa-8e06-7efa276e3212',
  transaction_id: 'a9325f90-6a5e-40fa-8e06-7efa276e1234',
  currency_id: '5b1ea92e584bf50020130617',
  txid: '0x123456789',
  timestamp: 1612510200,
  source_addresses: '0x1234',
  destination_addresses: '0x1234',
  amount: '0.00986735',
  result: true,
}];

module.exports = {
  up: (queryInterface) => queryInterface.bulkInsert('TokenTransaction', mockTokenTransaction, { ignoreDuplicates: true }),
  down: (queryInterface, Sequelize) => queryInterface.bulkDelete('TokenTransaction', {
    [Sequelize.Op.or]: mockTokenTransaction.filter((item) => ({ tokenTransaction_id: item.tokenTransaction_id })),
  }, {}),
};
