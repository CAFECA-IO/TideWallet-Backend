# TideWallet-Backend
Backend API Service and Blockchain Crawler for TideWallet

## General Requirements

- Node.js - v10.16.3

## API doc

[postman](https://github.com/BOLT-Protocol/TideWallet-Backend/blob/master/doc)


## Init FCM

```
source: https://firebase.google.com/docs/admin/setup#initialize-sdk

To generate a private key file for your service account:

In the Firebase console, open Settings > Service Accounts.

Click Generate New Private Key, then confirm by clicking Generate Key.

Securely store the JSON file containing the key.
```

copy file to `private/service-account-file.json`

## Init auto pull script

Step1. add update script

```
vim update.sh
```

```bash
changed=0
cd /home/ubuntu/TideWallet-Backend
git checkout .
git checkout develop
git remote update
git status -uno | grep 'Your branch is up to date'
changed=$?
if [ $changed = 1 ]; then
  git pull origin develop
  pm2 restart 1
  changed=0
fi
```

Step2. update script permissions

```
chmod +x update.sh
```

Step3. add crontab

```
crontab -e
```

```
*/1 * * * * /home/ubuntu/update.sh
```

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

## Install TideWallet Backend Parser
[TideWallet-Backend-Parser](https://github.com/BOLT-Protocol/TideWallet-Backend-Parser.git)

## Initial TideWallet Backend

### 1. Setup Your DB

TideWallet based on PostgreSQL, create a PostgreSQL first
1. install postgres
```shell
sudo apt update
sudo apt install postgresql postgresql-contrib
```

```shell
# 查看 PostgreSQL 服務狀態
systemctl status postgresql.service
```

2. create user
```shell
# 新增 PostgreSQL 使用者
# 會要求設定密碼
sudo -u postgres createuser tidewallet -P
```

3. 建立DB
```
// 可以查看 default.config.toml 共有哪些連線資訊
createdb bitcoin_mainnet -U postgres
createdb bitcoin_testnet -U postgres
createdb bitcoin_cash_mainnet -U postgres
createdb bitcoin_cash_testnet -U postgres
createdb ethereum_mainnet -U postgres
createdb ethereum_ropsten -U postgres
createdb cafeca -U postgres
createdb titan -U postgres
```

4. 對外連線設定

- 切換到postgres rule
```shell
sudo su - postgres
```

- 備份並修改`pg_hba.conf`
```shell
cp /etc/postgresql/12/main/postgresql.conf /etc/postgresql/12/main/ori_postgresql.conf

vim /etc/postgresql/12/main/postgresql.conf
```

- 加入 172.31網段
```
host    all             all             172.31.0.0/16           md5
```

- 備份並修改`postgresql.conf`來對外
```
cp /etc/postgresql/12/main/postgresql.conf /etc/postgresql/12/main/ori_postgresql.conf

vim /etc/postgresql/12/main/postgresql.conf
```

- 找到listen_addresses，改成
```
listen_addresses = '*'
```

5. 重開postgres
```shell
/etc/init.d/postgresql restart
```

### 2. Init Dependency

```shell
npm install
```

### 3. Set Config

```
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

## deploy all microservices

**所有要部署的agent機器需已安裝 Python@2.7.15, python-apt 跟 SSH**

本腳本使用 Ansible 撰寫，因此需要先行安裝 **Ansible@2.8.1**(太新版會有問題)

```
sudo apt-get update
sudo apt-get upgrade
sudo apt-get install python-pip 
pip install -Iv ansible==2.8.1
```

### Step1. copy ssh config, edit it!

```
cp ./tool/inventory.sample ./tool/inventory
```

### Step2. change run script(if you want custom script)

```
vim ./tool/sh.yml
```

### Step3. run ansible-playbook

```
ansible-playbook tool/playbook.yml
```

## notice

* sometimes crawler would be blocked for unknown reasons. It always happened after running several days.

* according [PostgreSQL Out Of Memory](https://italux.medium.com/postgresql-out-of-memory-3fc1105446d), postgres grow 9.6G memory usage in 60 mins during 20 Parsers before catch up blocks. can use crontab and pm2 restart to release connection.

* 防火牆允許port
```
PostgreSQL:
- 5432
RabbitMQ:
- 5671
- 5672
- 9187
Monitor
- 9100 (Prometheus)
- 9209 (??)
- 15672 (RabbitMQ Admin)
```

## 本地開發環境設定

須先安裝：

- Node.js
- Docker
- PostgreSQL(範例使用 docker 方法安裝)
- RabbitMQ(範例使用 docker 方法安裝)


### DB 安裝（docker）

```
docker run -p 5432:5432 -e "POSTGRES_PASSWORD=admin" -d -v data:/var/lib/postgresql/data --name db postgres:13.1
```

### DB 安裝 (apt)
```shell
sudo apt update
sudo apt install postgresql postgresql-contrib
```

```shell
# 查看 PostgreSQL 服務狀態
systemctl status postgresql.service
```

### 新增 PostgreSQL 使用者
```shell
# 新增 PostgreSQL 使用者
# 會要求設定密碼
sudo -u postgres createuser tidewallet -P
```

### 建立 DB 程式所需要的 db

```
// 可以查看 default.config.toml 共有哪些連線資訊
createdb bitcoin_mainnet -U postgres
createdb bitcoin_testnet -U postgres
createdb bitcoin_cash_mainnet -U postgres
createdb bitcoin_cash_testnet -U postgres
createdb ethereum_mainnet -U postgres
createdb ethereum_ropsten -U postgres
createdb cafeca -U postgres
createdb titan -U postgres
```

### 安裝 RabbitMQ （docker）

```
docker run -d \
--hostname my-rabbit \
--name rabbitmq \
-p 4369:4369 \
-p 5671:5671 \
-p 5672:5672 \
-p 15671:15671 \
-p 15672:15672 \
-e RABBITMQ_DEFAULT_USER=tidewallet \
-e RABBITMQ_DEFAULT_PASS=aw8YrUZZMAd4ehdu \
rabbitmq:3-management
```

### 設定設定檔

將範例的設定檔複製到 private/config.toml 後，修改成符合該環境的設定

```
cp ./default.config.toml private/config.toml
vim private/config.toml
```

### start

```
npm start
```