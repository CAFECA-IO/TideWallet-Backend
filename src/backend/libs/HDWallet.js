const { hdkey } = require('ethereumjs-wallet');
const bs58 = require('bs58');
const sha256 = require('js-sha256');
const bitcoin = require('bitcoinjs-lib');
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
  serializedExtendPublicKey(coinType = 0) {
    const MAINNET_PUB = '0488B21E';
    const TESTNET_PUB = '043587CF';
    const version = coinType === 1 ? TESTNET_PUB : MAINNET_PUB;
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
    coinType = 0, change = 0, index = 0, blockchainID,
  }) {
    const _serializedExtendPublicKey = this.serializedExtendPublicKey(coinType);
    let publicKey = '';
    let address = '';
    if (coinType === 0 || coinType === 1) {
      let _node = bitcoin.bip32.fromBase58(_serializedExtendPublicKey, bitcoin.networks[coinType === 0 ? 'bitcoin' : 'testnet']); // don't change this
      _node = _node.derive(change).derive(index);
      publicKey = _node.publicKey.toString('hex');
      address = Utils.toP2wpkhAddress(blockchainID, _node.publicKey);
    } else {
      const node = hdkey.fromExtendedKey(_serializedExtendPublicKey);
      this.hdWallet = node.deriveChild(change).deriveChild(index).getWallet();
      publicKey = this.hdWallet.getPublicKeyString();
      address = this.hdWallet.getAddressString();
    }

    return ({
      coinType,
      address,
      publicKey,
    });
  }
}

module.exports = HDWallet;
