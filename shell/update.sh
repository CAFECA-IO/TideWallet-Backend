changed=0
cd /home/ubuntu/TideWallet-Backend
git checkout .
git checkout main
git remote update
git status -uno | grep 'Your branch is up to date'
changed=$?
if [ $changed = 1 ]; then
  git pull origin main
  npm install
  npm run migrateDB
  pm2 restart all
  changed=0
fi