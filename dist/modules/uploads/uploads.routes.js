"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const authenticate_1 = require("../../shared/middlewares/authenticate");
const uploads_service_1 = require("./uploads.service");
const uploads_controller_1 = require("./uploads.controller");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        files: uploads_service_1.MAX_FILES,
        fileSize: uploads_service_1.MAX_BYTES,
    },
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
            cb(new Error("Only image files are allowed"));
            return;
        }
        cb(null, true);
    },
});
function handleServiceImagesUpload(req, res, next) {
    upload.array("images", uploads_service_1.MAX_FILES)(req, res, (err) => {
        if (err instanceof multer_1.default.MulterError) {
            if (err.code === "LIMIT_FILE_SIZE") {
                res.status(400).json({ message: "Each image must be 5MB or smaller" });
                return;
            }
            if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
                res.status(400).json({ message: err.message });
                return;
            }
            res.status(400).json({ message: err.message });
            return;
        }
        if (err instanceof Error) {
            res.status(400).json({ message: err.message });
            return;
        }
        next();
    });
}
router.post("/service-images", authenticate_1.authenticate, authenticate_1.requireServiceProvider, handleServiceImagesUpload, uploads_controller_1.postServiceImages);
exports.default = router;
