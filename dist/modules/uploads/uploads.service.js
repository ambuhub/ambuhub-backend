"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_FILES = exports.MAX_BYTES = exports.UploadHttpError = void 0;
exports.uploadServiceImagesToCloudinary = uploadServiceImagesToCloudinary;
const cloudinary_1 = require("../../config/cloudinary");
class UploadHttpError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = "UploadHttpError";
    }
}
exports.UploadHttpError = UploadHttpError;
const MAX_FILES = 10;
exports.MAX_FILES = MAX_FILES;
const MAX_BYTES = 5 * 1024 * 1024;
exports.MAX_BYTES = MAX_BYTES;
async function uploadServiceImagesToCloudinary(files) {
    const cloudinary = (0, cloudinary_1.getCloudinary)();
    const urls = [];
    for (const file of files) {
        if (!file.mimetype.startsWith("image/")) {
            throw new UploadHttpError(400, "Only image files are allowed");
        }
        const dataUri = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
        const result = await cloudinary.uploader.upload(dataUri, {
            folder: "services-images",
            resource_type: "image",
        });
        if (result.secure_url) {
            urls.push(result.secure_url);
        }
    }
    return urls;
}
