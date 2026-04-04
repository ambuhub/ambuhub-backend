"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listServicesHandler = listServicesHandler;
exports.getServiceBySlugHandler = getServiceBySlugHandler;
const service_service_1 = require("./service.service");
const logger_1 = require("../../shared/lib/logger");
async function listServicesHandler(_req, res) {
    try {
        const services = await (0, service_service_1.listServices)();
        res.status(200).json({ services });
    }
    catch (err) {
        logger_1.logger.error("list services failed", { error: err });
        res.status(500).json({ message: "Failed to load services" });
    }
}
async function getServiceBySlugHandler(req, res) {
    try {
        const raw = req.params.slug;
        const slug = Array.isArray(raw) ? raw[0] : raw;
        if (!slug?.trim()) {
            res.status(400).json({ message: "Slug is required" });
            return;
        }
        const service = await (0, service_service_1.getServiceBySlug)(slug);
        res.status(200).json({ service });
    }
    catch (err) {
        if (err instanceof service_service_1.ServiceHttpError) {
            res.status(err.statusCode).json({ message: err.message });
            return;
        }
        logger_1.logger.error("get service failed", { error: err });
        res.status(500).json({ message: "Failed to load service" });
    }
}
