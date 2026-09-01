/** Database adapter — MongoDB via Mongoose. */
import mongoose from 'mongoose';

export async function connectDatabase(uri = process.env.MONGODB_URI) {
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Copy .env.example to .env and configure it.');
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  return mongoose.connection;
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}

export async function checkDatabaseHealth() {
  const startedAt = Date.now();
  try {
    if (mongoose.connection.readyState !== 1) {
      return { status: 'DOWN', error: 'Not connected' };
    }
    await mongoose.connection.db.admin().ping();
    return { status: 'UP', latencyMs: Date.now() - startedAt };
  } catch (err) {
    return { status: 'DOWN', error: err.message };
  }
}
