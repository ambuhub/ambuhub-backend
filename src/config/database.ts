import mongoose from "mongoose";
import { logger } from "../shared/lib/logger";

/**
 * Connect to MongoDB database
 * @returns Promise<void>
 */
export const connectDatabase = async (): Promise<void> => {
  try {
    // Get MongoDB connection URI from environment variables
    const mongoUri = process.env.DB_URI;

    if (!mongoUri) {
      throw new Error(
        "MongoDB connection URI not found in environment variables. Please set DB_URI in your .env file."
      );
    }

    // MongoDB connection options
    const options: mongoose.ConnectOptions = {
      // These options help with connection stability
      dbName: process.env.DB_NAME,
      family: 4,
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    };

    // Connect to MongoDB
    await mongoose.connect(mongoUri, options);

    logger.info("Successfully connected to MongoDB");

    // Handle connection events
    mongoose.connection.on("error", (error) => {
      logger.error("MongoDB connection error", { error });
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected");
    });

    mongoose.connection.on("reconnected", () => {
      logger.info("MongoDB reconnected");
    });

    // Graceful shutdown
    process.on("SIGINT", async () => {
      await mongoose.connection.close();
      logger.info("MongoDB connection closed through app termination");
      process.exit(0);
    });
  } catch (error) {
    logger.error("Failed to connect to MongoDB", { error });
    throw error;
  }
};