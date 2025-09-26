import mongoose from 'mongoose';
import logger from '../utils/logger.js';

export const connectWithRetry = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI not set in .env');
  }

  try {
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');
  } catch (err) {
    logger.error('MongoDB connection error:', err);
    logger.info('Retrying MongoDB connection in 5 seconds...');
    setTimeout(connectWithRetry, 5000);
  }
};