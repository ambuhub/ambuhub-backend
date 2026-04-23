"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMarketplaceServices = getMarketplaceServices;
exports.getMyServices = getMyServices;
exports.postCreateService = postCreateService;
const services_service_1 = require("./services.service");
async function getMarketplaceServices(req, res) {
    try {
        const raw = req.query.categorySlug;
        const categorySlug = raw === undefined
            ? undefined
            : Array.isArray(raw)
                ? typeof raw[0] === "string"
                    ? raw[0]
                    : null
                : typeof raw === "string"
                    ? raw
                    : null;
        if (categorySlug === null) {
            res.status(400).json({ message: "categorySlug must be a string" });
            return;
        }
        const { services, bannerUrl } = await (0, services_service_1.listMarketplaceServices)(categorySlug);
        res.status(200).json({ services, bannerUrl });
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
