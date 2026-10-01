const express = require('express');
const { MongoClient, MongoError } = require('mongodb');
const path = require('node:path');

const app = express();
const port = Number(process.env.PORT || 3000);
const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017', {
  serverSelectionTimeoutMS: 2000,
  timeoutMS: 3000,
});
const db = client.db(process.env.MONGODB_DB || 'user');
const users = db.collection(process.env.MONGODB_COLLECTION || 'users');
// A fixed ID keeps this beginner demo focused on one profile.
const profileId = 'demo-profile';

app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.set('Cache-Control', 'no-store').json({ status: 'alive' });
});

app.get('/api/ready', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    // A real read verifies both connectivity and access to the app collection.
    await users.findOne({ _id: profileId }, { projection: { _id: 1 } });
    res.json({ status: 'ready', database: 'online' });
  } catch {
    res.status(503).json({ status: 'not-ready', database: 'offline' });
  }
});

app.get('/api/profile', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const profile = await users.findOne({ _id: profileId });
  res.json(profile || { name: '', email: '', interests: '' });
});

app.put('/api/profile', async (req, res) => {
  const { name, email, interests = '' } = req.body || {};
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100 ||
      typeof email !== 'string' || email.trim().length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof interests !== 'string' || interests.trim().length > 500) {
    return res.status(400).json({ error: 'Enter a name (up to 100 characters), a valid email, and interests (up to 500 characters).' });
  }
  const profile = {
    name: name.trim(), email: email.trim(), interests: interests.trim(), updatedAt: new Date(),
  };
  await users.updateOne({ _id: profileId }, { $set: profile }, { upsert: true });
  res.json({ _id: profileId, ...profile });
});

app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.' }));
app.use((error, req, res, next) => {
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body.' });
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });
  console.error('Request failed:', error.name, error.codeName || '');
  if (error instanceof MongoError) {
    return res.status(503).json({ error: 'Database unavailable. Check MongoDB and your .env configuration.' });
  }
  res.status(500).json({ error: 'Unexpected server error.' });
});

let server;
async function start() {
  try {
    await client.connect();
    await db.command({ ping: 1 });
    server = app.listen(port, '0.0.0.0', () => {
      console.log(`Profile app: http://localhost:${port}`);
      console.log(`MongoDB database: ${db.databaseName}; collection: ${users.collectionName}`);
    });
    server.on('error', async (error) => {
      console.error('HTTP server could not start:', error.code);
      await client.close();
      process.exitCode = 1;
    });
  } catch (error) {
    console.error(`MongoDB connection failed (${error.name}). Check MONGODB_URI in .env, credentials, and the published Docker port.`);
    await client.close();
    process.exitCode = 1;
  }
}

async function shutdown() {
  if (server) await new Promise(resolve => server.close(resolve));
  await client.close();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
start();
