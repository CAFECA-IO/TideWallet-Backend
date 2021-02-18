const mockBlockScanned = [{
  blockScanned_id: 'a9325f90-6a5e-40fa-8e06-7efa276e369b',
  blockchain_id: '80000001',
  block: 1000,
  block_hash: 'xxxxxxxxxxxxxx',
  timestamp: 1612510071,
  result: 'result',
}];

module.exports = {
  up: (queryInterface) => queryInterface.bulkInsert('BlockScanned', mockBlockScanned, { ignoreDuplicates: true }),
  down: (queryInterface, Sequelize) => queryInterface.bulkDelete('BlockScanned', {
    [Sequelize.Op.or]: mockBlockScanned.filter((item) => ({ blockScanned_id: item.blockScanned_id })),
  }, {}),
};
