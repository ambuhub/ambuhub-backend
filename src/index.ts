import express from "express";
import dotenv from "dotenv";
import { connectDatabase } from "./config/database";
import { setupRoutes } from "./routes/api";
import { setupMiddleware } from "./shared/middlewares/middleware";
import { logger } from "./shared/lib/logger";

dotenv.config();

const app = express();

// Setup middleware
setupMiddleware(app);

// Setup routes
setupRoutes(app);

// Start server
const PORT = process.env.PORT || 3002;

// Connect to database and start server

const startServer = async () => {
  try {
    await connectDatabase();
    app.listen(PORT, () => {
      logger.info(`Server started on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start server", { error });
    process.exit(1);
  }
};

startServer();
