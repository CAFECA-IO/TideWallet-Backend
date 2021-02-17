const { hdkey } = require('ethereumjs-wallet');
const Utils = require('./Utils');

class HDWallet {
  constructor({ extendPublicKey }) {
    this.name = 'HDWallet';
    this.hdWallet = null;
    this.extendPublicKey = extendPublicKey;
  }

  getWalletInfo({
    purpose = '44', coinType = '0', account = '0', change = '0', index = '0', blockchainID,
  }) {
    const node = hdkey.fromExtendedKey(this.extendPublicKey);

    const path = `m/${purpose}'/${coinType}'/${account}'/${change}/${index}`;
    console.log('path:', path);
    this.hdWallet = node.derivePath(path).getWallet();

    const publicKey = this.hdWallet.getPublicKeyString();
    let address = this.hdWallet.getAddressString();
    if (coinType === 0 || coinType === 1) {
      address = Utils.toP2pkhAddress(blockchainID, publicKey);
    }
    const privateKey = this.hdWallet.getPrivateKeyString();

    return ({
      coinType,
      address,
      publicKey,
      privateKey,
    });
  }
}

module.exports = HDWallet;
