"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postServiceImages = postServiceImages;
const cloudinary_1 = require("../../config/cloudinary");
const uploads_service_1 = require("./uploads.service");
async function postServiceImages(req, res) {
    try {
        const files = req.files ?? [];
        if (files.length === 0) {
            res.status(200).json({ urls: [] });
            return;
        }
        if (!(0, cloudinary_1.isCloudinaryEnabled)()) {
            res.status(503).json({
                message: "Image uploads are unavailable: Cloudinary is not configured on the server.",
            });
            return;
        }
        const urls = await (0, uploads_service_1.uploadServiceImagesToCloudinary)(files);
        res.status(200).json({ urls });
    }
    catch (err) {
        if (err instanceof uploads_service_1.UploadHttpError) {
            res.status(err.statusCode).json({ message: err.message });
            return;
        }
        throw err;
    }
}
