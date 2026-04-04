"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupMiddleware = void 0;
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const setupMiddleware = (app) => {
    const frontendOrigin = process.env.FRONTEND_URL || "http://localhost:3000";
    app.use((0, cors_1.default)({
        origin: frontendOrigin,
        credentials: true,
    }));
    app.use(express_1.default.json());
    app.use(express_1.default.urlencoded({ extended: true }));
};
exports.setupMiddleware = setupMiddleware;
