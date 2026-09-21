const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');

// Exclusive creation protects existing credentials.
const target = path.resolve(process.argv[2] || '.env');
const password = crypto.randomBytes(24).toString('hex');
const webPassword = crypto.randomBytes(24).toString('hex');
const content = `# Generated for this installation. Keep this file private.
PORT=3000
MONGO_ROOT_USERNAME=profile_admin
MONGO_ROOT_PASSWORD=${password}
MONGODB_URI='mongodb://profile_admin:${password}@127.0.0.1:27017/?authSource=admin'
MONGO_EXPRESS_URI='mongodb://profile_admin:${password}@mongodb:27017/?authSource=admin'
MONGODB_DB=user
MONGODB_COLLECTION=users
MONGO_EXPRESS_WEB_USERNAME=viewer
MONGO_EXPRESS_WEB_PASSWORD=${webPassword}
APP_IMAGE=profile-app:local
`;
try {
  fs.writeFileSync(target, content, { flag: 'wx', mode: 0o600 });
  console.log('Created configuration at ' + target);
  console.log('Mongo Express username: viewer. Find its password in MONGO_EXPRESS_WEB_PASSWORD.');
} catch (error) {
  if (error.code === 'EEXIST') {
    console.error('Configuration already exists; leaving it unchanged: ' + target);
  } else {
    console.error('Could not create configuration: ' + error.code);
  }
  process.exitCode = 1;
}
