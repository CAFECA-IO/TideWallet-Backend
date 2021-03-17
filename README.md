# TideWallet-Backend
Backend API Service and Blockchain Crawler for TideWallet

## API doc

[postmain](https://github.com/BOLT-Protocol/TideWallet-Backend/blob/master/doc)

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
