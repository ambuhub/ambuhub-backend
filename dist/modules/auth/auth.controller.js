"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerHandler = registerHandler;
exports.loginHandler = loginHandler;
const auth_service_1 = require("./auth.service");
const logger_1 = require("../../shared/lib/logger");
async function registerHandler(req, res) {
    try {
        const result = await (0, auth_service_1.register)(req.body);
        res.status(201).json(result);
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
        res.status(200).json(result);
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
