"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerHandler = registerHandler;
exports.loginHandler = loginHandler;
exports.logoutHandler = logoutHandler;
exports.forgotPasswordHandler = forgotPasswordHandler;
exports.getMeHandler = getMeHandler;
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
async function forgotPasswordHandler(req, res) {
    try {
        const body = req.body;
        await (0, auth_service_1.resetPasswordWithoutVerification)({
            email: String(body.email ?? ""),
            newPassword: String(body.newPassword ?? ""),
        });
        res.status(200).json({
            ok: true,
            message: "If an account exists for that email, the password has been updated. You can sign in with the new password.",
        });
    }
    catch (err) {
        if (err instanceof auth_service_1.AuthHttpError) {
            res.status(err.statusCode).json({ message: err.message });
            return;
        }
        logger_1.logger.error("forgot password failed", { error: err });
        res.status(500).json({ message: "Could not reset password" });
    }
}
async function getMeHandler(req, res) {
    try {
        if (!req.auth) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const user = await (0, auth_service_1.getSessionUser)(req.auth.userId);
        if (!user) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        res.status(200).json({ user });
    }
    catch (err) {
        logger_1.logger.error("getMe failed", { error: err });
        res.status(500).json({ message: "Could not load session" });
    }
}
