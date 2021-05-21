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
git checkout main
git remote update && git status -uno | grep -q 'Your branch is behind' && changed=1
if [ $changed = 1 ]; then
  git pull origin main
  pm2 restart 0
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
* * * * * /home/ubuntu/update.sh
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