const mongoose = require('mongoose');

async function connectDatabase(uri = process.env.MONGODB_URI) {
  if (!uri) {
    console.warn('⚠️ MONGODB_URI not provided. Skipping database connection.');
    return;
  }
  try {
    await mongoose.connect(uri);
    console.log('📦 Connected to MongoDB successfully.');
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB:', err.message);
  }
}

module.exports = { connectDatabase };
