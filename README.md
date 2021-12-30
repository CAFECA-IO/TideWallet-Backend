# TideWallet-Backend
Backend API Service and Blockchain Crawler for TideWallet

## General Requirements

- Node.js - v10.16.3

## API doc

[postman](https://github.com/CAFECA-IO/TideWallet-Backend/blob/master/doc)


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
  npm install
  npm run migrateDB
  pm2 restart all
  changed=0
fi
changed=0
cd /home/ubuntu/TideWallet-Backend-Parser
git checkout .
git checkout develop
git remote update
git status -uno | grep 'Your branch is up to date'
changed=$?
if [ $changed = 1 ]; then
  git pull origin develop
  npm install
  pm2 restart all
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
  rabbitmq:3.8-management
```

## Install TideWallet Backend Parser
[TideWallet-Backend-Parser](https://github.com/CAFECA-IO/TideWallet-Backend-Parser.git)

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

4. 設定權限

- 切換到postgres rule
```shell
sudo su - postgres
```

- 切換至psql
```shell
psql
```

設定super user 密碼
```
\password postgres
```

繼承權獻給user tidewallet
```
grant all privileges on database bitcoin_mainnet to tidewallet;
grant all privileges on database bitcoin_testnet to tidewallet;
grant all privileges on database bitcoin_cash_mainnet to tidewallet;
grant all privileges on database bitcoin_cash_testnet to tidewallet;
grant all privileges on database ethereum_mainnet to tidewallet;
grant all privileges on database ethereum_ropsten to tidewallet;
grant all privileges on database cafeca to tidewallet;
grant all privileges on database titan to tidewallet;
```

5. 對外連線設定

- 切換到postgres rule
```shell
sudo su - postgres
```

- 備份並修改`pg_hba.conf`
```shell
cp /etc/postgresql/12/main/pg_hba.conf /etc/postgresql/12/main/ori_pg_hba.conf

vim /etc/postgresql/12/main/pg_hba.conf
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

- 找到max_connections，改成
```
max_connections = 600
```

6. 重開postgres
```shell
sudo /etc/init.d/postgresql restart
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

* if used for crawler
```
// if you want to use eth mainnet crawler
[syncSwitch]
ethereum_mainnet = true
cryptoRate = true
rate = true
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

### Node.js

```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash
source ~/.bashrc
nvm install v10.16.3
nvm alias default v10.16.3
```
給node開 80 port權限

```
//$NODE_LOCATION 可以用 which node 查詢

sudo setcap 'cap_net_bind_service=+ep' $NODE_LOCATION
```

### Docker

```
sudo apt update
sudo apt install docker.io
```

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
先連線進DB
```shell=
docker exec -ti db bash
```
run下面的code建DB
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
sudo docker run -d \
--hostname my-rabbit \
--name rabbitmq \
-p 4369:4369 \
-p 5671:5671 \
-p 5672:5672 \
-p 15671:15671 \
-p 15672:15672 \
-e RABBITMQ_DEFAULT_USER=tidewallet \
-e RABBITMQ_DEFAULT_PASS=aw8YrUZZMAd4ehdu \
rabbitmq:3.8-management
```

### 設定設定檔

1. 將範例的設定檔複製到 private/config.toml 後，修改成符合該環境的設定

```
cp ./default.config.toml private/config.toml
vim private/config.toml
```
2. 新增 private/service-account-file.json(參考👆Init FC )

### start

```
npm start
```
