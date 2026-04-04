"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDatabase = void 0;
const dns = require('dns');
const mongoose_1 = __importDefault(require("mongoose"));
const logger_1 = require("../shared/lib/logger");
dns.setServers(['1.1.1.1', '8.8.8.8']);
/**
 * Connect to MongoDB database
 * @returns Promise<void>
 */
const connectDatabase = async () => {
    try {
        // Get MongoDB connection URI from environment variables
        const mongoUri = process.env.DB_URI;
        if (!mongoUri) {
            throw new Error("MongoDB connection URI not found in environment variables. Please set DB_URI in your .env file.");
        }
        // MongoDB connection options
        const options = {
            // These options help with connection stability
            dbName: process.env.DB_NAME,
            family: 4,
            maxPoolSize: 10, // Maintain up to 10 socket connections
            serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
            socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
        };
        // Connect to MongoDB
        await mongoose_1.default.connect(mongoUri, options);
        logger_1.logger.info("Successfully connected to MongoDB");
        // Handle connection events
        mongoose_1.default.connection.on("error", (error) => {
            logger_1.logger.error("MongoDB connection error", { error });
        });
        mongoose_1.default.connection.on("disconnected", () => {
            logger_1.logger.warn("MongoDB disconnected");
        });
        mongoose_1.default.connection.on("reconnected", () => {
            logger_1.logger.info("MongoDB reconnected");
        });
        // Graceful shutdown
        process.on("SIGINT", async () => {
            await mongoose_1.default.connection.close();
            logger_1.logger.info("MongoDB connection closed through app termination");
            process.exit(0);
        });
    }
    catch (error) {
        logger_1.logger.error("Failed to connect to MongoDB", { error });
        throw error;
    }
};
exports.connectDatabase = connectDatabase;
