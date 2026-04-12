"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const cloudinary_1 = require("./config/cloudinary");
const database_1 = require("./config/database");
const serviceCategories_service_1 = require("./modules/serviceCategories/serviceCategories.service");
const api_1 = require("./routes/api");
const middleware_1 = require("./shared/middlewares/middleware");
const logger_1 = require("./shared/lib/logger");
dotenv_1.default.config();
const app = (0, express_1.default)();
// Setup middleware
(0, middleware_1.setupMiddleware)(app);
// Setup routes
(0, api_1.setupRoutes)(app);
// Start server
const PORT = process.env.PORT || 3002;
// Connect to database and start server
const startServer = async () => {
    try {
        (0, cloudinary_1.initCloudinary)();
        await (0, database_1.connectDatabase)();
        await (0, serviceCategories_service_1.ensureServiceCategoryCatalogSeeded)();
        app.listen(PORT, () => {
            logger_1.logger.info(`Server started on port ${PORT}`);
        });
    }
    catch (error) {
        logger_1.logger.error("Failed to start server", { error });
        process.exit(1);
    }
};
startServer();
