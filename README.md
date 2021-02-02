# TideWallet-Backend
Backend API Service and Blockchain Crawler for TideWallet

## API doc

[postmain](https://github.com/BOLT-Protocol/TideWallet-Backend/blob/master/doc)

## config
```shell
cp default.config.toml ./private/config.toml
vi ./private/config.toml
```

```toml
[api]
pathname = [
  "get | /,/version | Static.Utils.readPackageInfo"
]

# [method] | [path] | [execute function]
```

## Run Project
```
npm install
npm start
```
