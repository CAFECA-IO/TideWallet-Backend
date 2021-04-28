const firebaseAdmin = require('firebase-admin');
const Bot = require('./Bot');
const Utils = require('./Utils');
const serviceAccount = require('../../../private/service-account-file.json') || {};

class Fcm {
  constructor({ logger }) {
    this.logger = logger;
    this.firebase = firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(serviceAccount),
    });

    this.allTopic = 'allUser';
  }

  async registAccountFCMToken(userID, token, retry = 5) {
    await this.firebase.messaging()
      .subscribeToTopic(token, userID)
      .then(() => {
        this.logger.log(`registAccountFCMToken userID(${userID}) success`);
      })
      .catch((error) => {
        console.log(error);
        this.logger.log('registAccountFCMToken error subscribing to topic:', JSON.stringify(error));
        if (retry < 0) {
          throw error;
        }
        setTimeout(() => {
          this.registAccountFCMToken(userID, token, retry -= 1);
        }, 500 * retry);
      });

    await this.firebase.messaging()
      .subscribeToTopic(token, this.allTopic)
      .then(() => {
        this.logger.log(`registAccountFCMToken userID(${userID}) success`);
      })
      .catch((error) => {
        console.log(error);
        this.logger.log('registAccountFCMToken error subscribing to topic:', JSON.stringify(error));
        if (retry < 0) {
          throw error;
        }
        setTimeout(() => {
          this.registAccountFCMToken(userID, token, retry -= 1);
        }, 500 * retry);
      });
  }

  async unRegistAccountFCMToken(userID, token, retry = 5) {
    await this.firebase.messaging()
      .unsubscribeFromTopic(token, userID)
      .then(() => {
        this.logger.log(`registAccountFCMToken userID(${userID}) success`);
      })
      .catch((error) => {
        console.log(error);
        this.logger.log('registAccountFCMToken error subscribing to topic:', JSON.stringify(error));
        if (retry < 0) {
          throw error;
        }
        setTimeout(() => {
          this.registAccountFCMToken(userID, token, retry -= 1);
        }, 500 * retry);
      });

    await this.firebase.messaging()
      .unsubscribeFromTopic(token, this.allTopic)
      .then(() => {
        this.logger.log(`registAccountFCMToken userID(${userID}) success`);
      })
      .catch((error) => {
        console.log(error);
        this.logger.log('registAccountFCMToken error subscribing to topic:', JSON.stringify(error));
        if (retry < 0) {
          throw error;
        }
        setTimeout(() => {
          this.registAccountFCMToken(userID, token, retry -= 1);
        }, 500 * retry);
      });
  }

  async messageToUserTopic(userID, notification, data) {
    const messageObj = {
      notification,
      data,
      topic: userID,
      android: {
        ttl: 1000,
        notification: {
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
        },
      },
      webpush: {
        headers: {
          TTL: '1000',
        },
      },
    };

    await this.firebase
      .messaging()
      .send(messageObj)
      .then((test) => {
        console.log('test:', test);
      })
      .catch((error) => {
        console.log('Error sending message:', error);
      });
  }
}

let instance;

module.exports = {
  getInstance(options) {
    if (!instance) {
      instance = new Fcm(options);
    }
    return instance;
  },
};
