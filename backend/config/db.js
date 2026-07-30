const mongoose = require('mongoose');
const logger = require('../utils/logger');

async function connectDB() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    logger.error('MONGO_URI is not defined in environment variables');
    process.exit(1);
  }

  mongoose.set('strictQuery', true);

  const connect = async (retries = 5, delayMs = 3000) => {
    try {
      await mongoose.connect(uri, {
        maxPoolSize: 20, // connection pooling for performance
        serverSelectionTimeoutMS: 8000,
      });
      logger.info(`MongoDB connected: ${mongoose.connection.host}`);
    } catch (err) {
      logger.error(`MongoDB connection failed: ${err.message}`);
      if (retries > 0) {
        logger.info(`Retrying connection in ${delayMs / 1000}s... (${retries} retries left)`);
        setTimeout(() => connect(retries - 1, delayMs), delayMs);
      } else {
        logger.error('Exhausted MongoDB connection retries. Exiting.');
        process.exit(1);
      }
    }
  };

  await connect();

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  mongoose.connection.on('error', (err) => {
    logger.error(`MongoDB error: ${err.message}`);
  });
}

module.exports = connectDB;
