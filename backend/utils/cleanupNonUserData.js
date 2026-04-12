const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

const connectDB = require('../config/db');
const { delPattern } = require('../config/cache');

const KEEP_COLLECTIONS = new Set([
  'users',
  'permissions',
  'adminscopes',
  'yearcounters',
]);

const clearKnownCaches = async () => {
  const patterns = [
    'stats:*',
    'announcements:*',
    'opportunities:*',
    'events:*',
    'users:*',
    'user:*',
    'chat:*',
  ];

  await Promise.all(patterns.map((pattern) => delPattern(pattern).catch(() => {})));
};

const cleanupNonUserData = async () => {
  await connectDB();

  const collections = await mongoose.connection.db.listCollections().toArray();
  const summary = [];

  for (const collectionInfo of collections) {
    const collectionName = collectionInfo.name;
    if (KEEP_COLLECTIONS.has(collectionName) || collectionName.startsWith('system.')) {
      continue;
    }

    const collection = mongoose.connection.db.collection(collectionName);
    const result = await collection.deleteMany({});
    summary.push({ collection: collectionName, deletedCount: result.deletedCount || 0 });
  }

  await clearKnownCaches();

  return summary;
};

cleanupNonUserData()
  .then((summary) => {
    console.log('Cleaned non-user data collections:');
    summary.forEach((entry) => {
      console.log(`- ${entry.collection}: ${entry.deletedCount}`);
    });
    process.exit(0);
  })
  .catch((error) => {
    console.error(`Cleanup failed: ${error.message}`);
    process.exit(1);
  });
