if [ -f ./env.bitcoin_mainnet.js ]; then
  ./node_modules/.bin/sequelize db:migrate:undo:all --env development --config ./env.bitcoin_mainnet.js --migrations-path ./src/database/migrations --models-path ./src/database/models
fi
if [ -f ./env.bitcoin_testnet.js ]; then
./node_modules/.bin/sequelize db:migrate:undo:all --env development --config ./env.bitcoin_testnet.js --migrations-path ./src/database/migrations --models-path ./src/database/models \
fi
if [ -f ./env.cafeca.js ]; then
./node_modules/.bin/sequelize db:migrate:undo:all --env development --config ./env.cafeca.js --migrations-path ./src/database/migrations --models-path ./src/database/models \
fi
if [ -f ./env.ethereum_mainnet.js ]; then
./node_modules/.bin/sequelize db:migrate:undo:all --env development --config ./env.ethereum_mainnet.js --migrations-path ./src/database/migrations --models-path ./src/database/models \
fi
if [ -f ./env.ethereum_ropsten.js ]; then
./node_modules/.bin/sequelize db:migrate:undo:all --env development --config ./env.ethereum_ropsten.js --migrations-path ./src/database/migrations --models-path ./src/database/models
fi
