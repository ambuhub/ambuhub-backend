import express from "express";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import { initCloudinary } from "./config/cloudinary";
import { connectDatabase } from "./config/database";
import { swaggerSpec } from "./config/swagger";
import { ensureServiceCategoryCatalogSeeded } from "./modules/serviceCategories/serviceCategories.service";
import { setupRoutes } from "./routes/api";
import { setupMiddleware } from "./shared/middlewares/middleware";
import { logger } from "./shared/lib/logger";

dotenv.config();

const app = express();

// Setup middleware
setupMiddleware(app);

// Setup routes
setupRoutes(app);

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    swaggerOptions: { withCredentials: true },
  }),
);

// Start server
const PORT = process.env.PORT || 3002;

// Connect to database and start server

const startServer = async () => {
  try {
    initCloudinary();
    await connectDatabase();
    await ensureServiceCategoryCatalogSeeded();
    app.listen(PORT, () => {
      logger.info(`Server started on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start server", { error });
    process.exit(1);
  }
};

startServer();
