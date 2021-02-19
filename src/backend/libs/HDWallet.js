const { hdkey } = require('ethereumjs-wallet');
const bs58 = require('bs58');
const sha256 = require('js-sha256');
const blockchainNetworks = require('./data/blockchainNetworks');
const Utils = require('./Utils');

class HDWallet {
  constructor({ extendPublicKey }) {
    this.name = 'HDWallet';
    this.hdWallet = null;
    this.parentFP = '';
    this.chainCode = '';
    this.key = '';

    const decode = bs58.decode(extendPublicKey).toString('hex');
    if (decode.length === 164) {
      // https://learnmeabitcoin.com/technical/extended-keys - 5. Serialization
      this.parentFP = decode.slice(10, 18);
      this.chainCode = decode.slice(26, 90);
      this.key = decode.slice(90, 156);
    }
  }

  /**
    see: https://learnmeabitcoin.com/guide/extended-keys
  */
  serializedExtendPublicKey(network) {
    const MAINNET_PUB = '0488b21e';
    const version = (network.bip32.public) ? network.bip32.public.toString(16).padStart(8, 0) : MAINNET_PUB;
    const _depth = '03'.toString(16);
    const _index = '00000000'.toString(16);

    const serialization = version + _depth + this.parentFP + _index + this.chainCode + this.key;

    const check = this.checksum(serialization);

    return bs58.encode(Buffer.from(serialization + check, 'hex'));
  }

  checksum(data) {
    const step1 = sha256(Buffer.from(data, 'hex'));
    const step2 = sha256(Buffer.from(step1, 'hex'));

    return step2.substring(0, 8);
  }

  getWalletInfo({
    coinType = '0', change = '0', index = '0', blockchainID,
  }) {
    const findNetwork = Object.values(blockchainNetworks).find((value) => value.coin_type === coinType);
    console.log('findNetwork:', findNetwork);
    const _serializedExtendPublicKey = this.serializedExtendPublicKey(findNetwork);
    console.log('_serializedExtendPublicKey:', _serializedExtendPublicKey);
    const node = hdkey.fromExtendedKey(_serializedExtendPublicKey);
    this.hdWallet = node.deriveChild(change).deriveChild(index).getWallet();
    const publicKey = this.hdWallet.getPublicKeyString();

    let address = this.hdWallet.getAddressString();
    console.log('address:', address);
    if (coinType === 0 || coinType === 1) {
      address = Utils.toP2pkhAddress(blockchainID, publicKey);
    }
    console.log('address:', address);

    return ({
      coinType,
      address,
      publicKey,
    });
  }
}

module.exports = HDWallet;
