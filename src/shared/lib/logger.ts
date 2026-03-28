import winston from "winston";

/**
 * PM2-friendly Logger using Winston
 */
class Logger {
  private logger: winston.Logger;

  constructor() {
    const isProd = process.env.NODE_ENV === "production";

    // Format for console logs
    const formatParts = [
      // Only colorize in development
      ...(isProd ? [] : [winston.format.colorize()]),
      winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let logMessage = `${timestamp} [${level}]: ${message}`;
        if (Object.keys(meta).length > 0) {
          logMessage += ` ${JSON.stringify(meta)}`;
        }
        return logMessage;
      }),
    ];

    const consoleFormat = winston.format.combine(...formatParts);

    // Create Winston logger
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || "info",
      defaultMeta: { service: "ambuhub-backend" },
      transports: [
        new winston.transports.Console({
          format: consoleFormat,
        }),
      ],
      exceptionHandlers: [
        new winston.transports.Console({ format: consoleFormat }),
      ],
      rejectionHandlers: [
        new winston.transports.Console({ format: consoleFormat }),
      ],
    });
  }

  error(message: string, meta?: any): void {
    this.logger.error(message, meta);
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }
}

// Export singleton instance
export const logger = new Logger();