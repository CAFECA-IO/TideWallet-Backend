const mockTransaction = [{
  transaction_id: 'a9325f90-6a5e-40fa-8e06-7efa276eaaaa',
  currency_id: '5b1ea92e584bf50020130612',
  txid: '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b',
  timestamp: 1612510071,
  source_addresses: '[1wHoLpp5SGxLhQtmecBWJKS7wMKpFtTdM,1HFe8Eezn8x8rRLzujwDw6FF86RowGxRgz,1wHoLpp5SGxLhQtmecBWJKS7wMKpFtTdM]',
  destination_addresses: '1Jy1L1XyFXDUnXU78yTzHbr4BUPVedyEMW',
  amount: '0.00986735',
  fee: '0.00012548',
  block: 1944,
}, {
  transaction_id: 'a9325f90-6a5e-40fa-8e06-7efa276ecccc',
  currency_id: '5b1ea92e584bf50020130612',
  txid: '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b',
  timestamp: 1612510000,
  source_addresses: '[1wHoLpp5SGxLhQtmecBWJKS7wMKpFtTdM,1HFe8Eezn8x8rRLzujwDw6FF86RowGxRgz,1wHoLpp5SGxLhQtmecBWJKS7wMKpFtTdM]',
  destination_addresses: '1Jy1L1XyFXDUnXU78yTzHbr4BUPVedyEMW',
  amount: '0.00986735',
  fee: '0.00012548',
  block: 1944,
}, {
  transaction_id: 'a9325f90-6a5e-40fa-8e06-7efa276eeeee',
  currency_id: '5b1ea92e584bf50020130612',
  txid: '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b',
  timestamp: 1612510100,
  source_addresses: '[1wHoLpp5SGxLhQtmecBWJKS7wMKpFtTdM,1HFe8Eezn8x8rRLzujwDw6FF86RowGxRgz,1wHoLpp5SGxLhQtmecBWJKS7wMKpFtTdM]',
  destination_addresses: '1Jy1L1XyFXDUnXU78yTzHbr4BUPVedyEMW',
  amount: '0.00986735',
  fee: '0.00012548',
  block: 1944,
}, {
  transaction_id: 'a9325f90-6a5e-40fa-8e06-7efa276e1234',
  currency_id: '5b1ea92e584bf50020130617',
  txid: '0x123456789',
  timestamp: 1612510200,
  source_addresses: '0x123',
  destination_addresses: '0x123',
  amount: '0',
  fee: '0.00012548',
  nonce: 123,
  gas_price: 123,
  gas_used: 120,
  block: 1944,
}];

module.exports = {
  up: (queryInterface) => queryInterface.bulkInsert('Transaction', mockTransaction, { ignoreDuplicates: true }),
  down: (queryInterface, Sequelize) => queryInterface.bulkDelete('Transaction', {
    [Sequelize.Op.or]: mockTransaction.filter((item) => ({ transaction_id: item.transaction_id })),
  }, {}),
};
