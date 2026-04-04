"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
/**
 * PM2-friendly Logger using Winston
 */
class Logger {
    constructor() {
        const isProd = process.env.NODE_ENV === "production";
        // Format for console logs
        const formatParts = [
            // Only colorize in development
            ...(isProd ? [] : [winston_1.default.format.colorize()]),
            winston_1.default.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
            winston_1.default.format.errors({ stack: true }),
            winston_1.default.format.splat(),
            winston_1.default.format.printf(({ timestamp, level, message, ...meta }) => {
                let logMessage = `${timestamp} [${level}]: ${message}`;
                if (Object.keys(meta).length > 0) {
                    logMessage += ` ${JSON.stringify(meta)}`;
                }
                return logMessage;
            }),
        ];
        const consoleFormat = winston_1.default.format.combine(...formatParts);
        // Create Winston logger
        this.logger = winston_1.default.createLogger({
            level: process.env.LOG_LEVEL || "info",
            defaultMeta: { service: "ambuhub-backend" },
            transports: [
                new winston_1.default.transports.Console({
                    format: consoleFormat,
                }),
            ],
            exceptionHandlers: [
                new winston_1.default.transports.Console({ format: consoleFormat }),
            ],
            rejectionHandlers: [
                new winston_1.default.transports.Console({ format: consoleFormat }),
            ],
        });
    }
    error(message, meta) {
        this.logger.error(message, meta);
    }
    warn(message, meta) {
        this.logger.warn(message, meta);
    }
    info(message, meta) {
        this.logger.info(message, meta);
    }
    debug(message, meta) {
        this.logger.debug(message, meta);
    }
}
// Export singleton instance
exports.logger = new Logger();
