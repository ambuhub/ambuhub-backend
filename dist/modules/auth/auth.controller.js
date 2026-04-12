"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerHandler = registerHandler;
exports.loginHandler = loginHandler;
exports.logoutHandler = logoutHandler;
const auth_cookie_1 = require("./auth.cookie");
const auth_service_1 = require("./auth.service");
const logger_1 = require("../../shared/lib/logger");
async function registerHandler(req, res) {
    try {
        const result = await (0, auth_service_1.register)(req.body);
        (0, auth_cookie_1.setAuthCookie)(res, result.token);
        res.status(201).json({ user: result.user });
    }
    catch (err) {
        if (err instanceof auth_service_1.AuthHttpError) {
            res.status(err.statusCode).json({ message: err.message });
            return;
        }
        logger_1.logger.error("register failed", { error: err });
        res.status(500).json({ message: "Registration failed" });
    }
}
async function loginHandler(req, res) {
    try {
        const result = await (0, auth_service_1.login)(req.body);
        (0, auth_cookie_1.setAuthCookie)(res, result.token);
        res.status(200).json({ user: result.user });
    }
    catch (err) {
        if (err instanceof auth_service_1.AuthHttpError) {
            res.status(err.statusCode).json({ message: err.message });
            return;
        }
        logger_1.logger.error("login failed", { error: err });
        res.status(500).json({ message: "Login failed" });
    }
}
function logoutHandler(_req, res) {
    (0, auth_cookie_1.clearAuthCookie)(res);
    res.status(200).json({ ok: true });
}
