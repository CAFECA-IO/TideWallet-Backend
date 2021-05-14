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
        console.log(error); // -- no console.log
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
        console.log(error); // -- no console.log
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
    };

    await this.firebase
      .messaging()
      .send(messageObj)
      .then((test) => {
        console.log('messageToUserTopic:', test); // -- no console.log
      })
      .catch((error) => {
        console.log('Error sending message:', error); // -- no console.log
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
