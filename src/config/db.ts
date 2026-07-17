import mongoose from 'mongoose';

/**
 * Connects to MongoDB using the MONGO_URI environment variable.
 */
export const connectDB = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('CRITICAL: MONGO_URI is not defined in the environment variables.');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('Mongoose connected to MongoDB successfully.');
  } catch (error) {
    console.error('Mongoose MongoDB connection failed on startup:', error);
    // We do not exit the process so the web server remains active and Mongoose can auto-reconnect once the database is online.
  }
};
