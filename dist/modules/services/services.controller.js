"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMarketplaceServices = getMarketplaceServices;
exports.getMyServices = getMyServices;
exports.postCreateService = postCreateService;
const services_service_1 = require("./services.service");
async function getMarketplaceServices(_req, res) {
    try {
        const services = await (0, services_service_1.listMarketplaceServices)();
        res.status(200).json({ services });
    }
    catch (err) {
        if (err instanceof services_service_1.ServicesHttpError) {
            res.status(err.statusCode).json({ message: err.message });
            return;
        }
        throw err;
    }
}
async function getMyServices(req, res) {
    try {
        if (!req.auth) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const services = await (0, services_service_1.listMyServices)(req.auth.userId);
        res.status(200).json({ services });
    }
    catch (err) {
        if (err instanceof services_service_1.ServicesHttpError) {
            res.status(err.statusCode).json({ message: err.message });
            return;
        }
        throw err;
    }
}
async function postCreateService(req, res) {
    try {
        if (!req.auth) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const body = req.body;
        const photoUrls = Array.isArray(body.photoUrls)
            ? body.photoUrls.map((u) => String(u))
            : undefined;
        const service = await (0, services_service_1.createService)(req.auth.userId, {
            title: String(body.title ?? ""),
            description: String(body.description ?? ""),
            serviceCategorySlug: String(body.serviceCategorySlug ?? ""),
            departmentSlug: String(body.departmentSlug ?? ""),
            photoUrls,
        });
        res.status(201).json({ service });
    }
    catch (err) {
        if (err instanceof services_service_1.ServicesHttpError) {
            res.status(err.statusCode).json({ message: err.message });
            return;
        }
        throw err;
    }
}
