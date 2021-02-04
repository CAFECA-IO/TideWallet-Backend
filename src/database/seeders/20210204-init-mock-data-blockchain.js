const mockBlockchain = [{
  Blockchain_id: '80000000',
  name: 'Bitcoin',
  coin_type: 0,
  network_id: 0,
  publish: true,
  description: 'Bitcoin description',
  block: 0,
},
{
  Blockchain_id: '80000001',
  name: 'Bitcoin Testnet',
  coin_type: 1,
  network_id: 0,
  publish: false,
  description: 'Bitcoin Testnet description',
  block: 0,
},
{
  Blockchain_id: '80000060',
  name: 'Ethereum',
  coin_type: 60,
  network_id: 0,
  publish: true,
  description: 'Ethereum description',
  block: 0,
},
{
  Blockchain_id: '80000603',
  name: 'Ropsten',
  coin_type: 603,
  network_id: 3,
  publish: false,
  description: 'Ropsten description',
  block: 0,
},
{
  Blockchain_id: '80003324',
  name: 'Cafeca',
  coin_type: 3324,
  network_id: 0,
  publish: true,
  description: 'Cafeca description',
  block: 0,
}];

module.exports = {
  up: (queryInterface) => queryInterface.bulkInsert('Blockchain', mockBlockchain, { ignoreDuplicates: true }),
  down: (queryInterface, Sequelize) => queryInterface.bulkDelete('Blockchain', {
    [Sequelize.Op.or]: mockBlockchain.filter((item) => ({ Blockchain_id: item.Blockchain_id })),
  }, {}),
};
