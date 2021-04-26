module.exports = {
  bitcoin_mainnet: {
    db_name: 'bitcoin_mainnet',
    blockchain_id: '80000000',
    name: 'Bitcoin',
    coin_type: 0,
    network_id: 0,
    publish: true,
    description: 'Bitcoin description',
    block: 0,
    bip32: {
      public: 0x0488b21e,
      private: 0x0488ade4,
    },
    pubKeyHash: 0x00,
    scriptHash: 0x05,
    wif: 0x80,
    start_block: 671687,
    avg_fee: '0',
  },
  bitcoin_testnet: {
    db_name: 'bitcoin_testnet',
    blockchain_id: '80000001',
    name: 'Bitcoin Testnet',
    coin_type: 1,
    network_id: 0,
    publish: false,
    description: 'Bitcoin Testnet description',
    block: 0,
    bip32: {
      public: 0x043587cf,
      private: 0x04358394,
    },
    pubKeyHash: 0x6f,
    scriptHash: 0xc4,
    wif: 0xef,
    start_block: 1937267,
    avg_fee: '0',
  },
  ethereum_mainnet: {
    db_name: 'ethereum_mainnet',
    blockchain_id: '8000003C',
    name: 'Ethereum',
    coin_type: 60,
    network_id: 1,
    publish: true,
    description: 'Ethereum description',
    block: 0,
    bip32: {
      public: 0,
      private: 0,
    },
    pubKeyHash: 0,
    scriptHash: 0,
    wif: 0,
    start_block: 11906119,
    avg_fee: '0',
  },
  ethereum_ropsten: {
    db_name: 'ethereum_ropsten',
    blockchain_id: '8000025B',
    name: 'Ropsten',
    coin_type: 603,
    network_id: 3,
    publish: false,
    description: 'Ropsten description',
    block: 0,
    bip32: {
      public: 0,
      private: 0,
    },
    pubKeyHash: 0,
    scriptHash: 0,
    wif: 0,
    start_block: 9722974,
    avg_fee: '0',
  },
  titan: {
    db_name: 'titan',
    blockchain_id: '80001F51',
    name: 'TITAN',
    coin_type: 8017,
    network_id: 8017,
    publish: true,
    description: 'TITAN description',
    block: 0,
    bip32: {
      public: 0,
      private: 0,
    },
    pubKeyHash: 0,
    scriptHash: 0,
    wif: 0,
    start_block: 0,
    avg_fee: '0',
  },
};
