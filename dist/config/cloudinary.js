"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloudinary = void 0;
exports.initCloudinary = initCloudinary;
exports.isCloudinaryEnabled = isCloudinaryEnabled;
exports.getCloudinary = getCloudinary;
const cloudinary_1 = require("cloudinary");
Object.defineProperty(exports, "cloudinary", { enumerable: true, get: function () { return cloudinary_1.v2; } });
const logger_1 = require("../shared/lib/logger");
let configured = false;
/**
 * Load Cloudinary from environment variables.
 * Safe to call on every server start; skips configuration if credentials are missing.
 *
 * Required when enabled (set all three in `.env`):
 * - CLOUDINARY_CLOUD_NAME
 * - CLOUDINARY_API_KEY
 * - CLOUDINARY_API_SECRET
 */
function initCloudinary() {
    const cloud_name = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const api_key = process.env.CLOUDINARY_API_KEY?.trim();
    const api_secret = process.env.CLOUDINARY_API_SECRET?.trim();
    if (!cloud_name || !api_key || !api_secret) {
        logger_1.logger.warn("Cloudinary not configured: set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to enable uploads");
        configured = false;
        return false;
    }
    cloudinary_1.v2.config({
        cloud_name,
        api_key,
        api_secret,
        secure: true,
    });
    configured = true;
    logger_1.logger.info("Cloudinary configured", { cloud_name });
    return true;
}
function isCloudinaryEnabled() {
    return configured;
}
/**
 * Use for uploads and URL helpers. Throws if `initCloudinary()` did not succeed.
 */
function getCloudinary() {
    if (!configured) {
        throw new Error("Cloudinary is not configured. Set CLOUDINARY_* env vars and ensure initCloudinary() ran at startup.");
    }
    return cloudinary_1.v2;
}
