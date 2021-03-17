# TideWallet-Backend
Backend API Service and Blockchain Crawler for TideWallet

## API doc

[postmain](https://github.com/BOLT-Protocol/TideWallet-Backend/blob/master/doc)


## Install RabbitMQ

```
docker run -d \
  --hostname my-rabbit \
  --name rabbitmq -p 4369:4369 \
  -p 5671:5671 \
  -p 5672:5672 \
  -p 15671:15671 \
  -p 15672:15672 \
  -e RABBITMQ_DEFAULT_USER=user \
  -e RABBITMQ_DEFAULT_PASS=password \
  rabbitmq:3-management
```

## Initial TideWallet Backend

### 1. Setup Your DB

TideWallet based on PostgreSQL, create a PostgreSQL first

### 2. Init Dependency

```shell
npm install
```

### 3. Set Config

```shell
// copy sample config to private folder(if not exist, create it)
cp default.config.toml ./private/config.toml

// set your env
vi ./private/config.toml
```

### 4. Run Project
```
npm install
npm start
```
