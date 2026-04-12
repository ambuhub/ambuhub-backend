"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.requireServiceProvider = requireServiceProvider;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const auth_cookie_1 = require("../../modules/auth/auth.cookie");
function requireJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET is not set");
    }
    return secret;
}
function authenticate(req, res, next) {
    const token = req.cookies?.[auth_cookie_1.AUTH_COOKIE_NAME];
    if (!token || typeof token !== "string") {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    let secret;
    try {
        secret = requireJwtSecret();
    }
    catch {
        res.status(500).json({ message: "Server misconfiguration" });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        const userId = String(decoded.sub ?? decoded.userId ?? "");
        const role = typeof decoded.role === "string" ? decoded.role : "";
        if (!userId || !role) {
            res.status(401).json({ message: "Invalid token" });
            return;
        }
        req.auth = { userId, role };
        next();
    }
    catch {
        res.status(401).json({ message: "Invalid or expired token" });
    }
}
function requireServiceProvider(req, res, next) {
    if (!req.auth) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    if (req.auth.role !== "service_provider") {
        res.status(403).json({ message: "Forbidden" });
        return;
    }
    next();
}
