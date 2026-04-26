"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMarketplaceServices = getMarketplaceServices;
exports.getMyServices = getMyServices;
exports.postCreateService = postCreateService;
exports.putUpdateService = putUpdateService;
const services_service_1 = require("./services.service");
function parseServicePayload(body) {
    const photoUrls = Array.isArray(body.photoUrls)
        ? body.photoUrls.map((u) => String(u))
        : undefined;
    const listingTypeRaw = body.listingType;
    const listingType = listingTypeRaw === null || listingTypeRaw === undefined
        ? null
        : typeof listingTypeRaw === "string"
            ? listingTypeRaw
            : undefined;
    const stockRaw = body.stock;
    const stock = stockRaw === null || stockRaw === undefined
        ? null
        : typeof stockRaw === "number"
            ? stockRaw
            : typeof stockRaw === "string"
                ? Number(stockRaw)
                : undefined;
    const priceRaw = body.price;
    const price = priceRaw === null || priceRaw === undefined
        ? null
        : typeof priceRaw === "number"
            ? priceRaw
            : typeof priceRaw === "string"
                ? Number(priceRaw)
                : undefined;
    return {
        title: String(body.title ?? ""),
        description: String(body.description ?? ""),
        serviceCategorySlug: String(body.serviceCategorySlug ?? ""),
        departmentSlug: String(body.departmentSlug ?? ""),
        listingType,
        stock,
        price,
        photoUrls,
    };
}
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
        const payload = parseServicePayload(body);
        const service = await (0, services_service_1.createService)(req.auth.userId, {
            title: payload.title,
            description: payload.description,
            serviceCategorySlug: payload.serviceCategorySlug,
            departmentSlug: payload.departmentSlug,
            listingType: payload.listingType,
            stock: payload.stock,
            price: payload.price,
            photoUrls: payload.photoUrls,
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
async function putUpdateService(req, res) {
    try {
        if (!req.auth) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const body = req.body;
        const payload = parseServicePayload(body);
        const rawServiceId = req.params.id;
        const serviceId = typeof rawServiceId === "string" ? rawServiceId : "";
        const service = await (0, services_service_1.updateService)(req.auth.userId, {
            serviceId,
            title: payload.title,
            description: payload.description,
            serviceCategorySlug: payload.serviceCategorySlug,
            departmentSlug: payload.departmentSlug,
            listingType: payload.listingType,
            stock: payload.stock,
            price: payload.price,
            photoUrls: payload.photoUrls,
        });
        res.status(200).json({ service });
    }
    catch (err) {
        if (err instanceof services_service_1.ServicesHttpError) {
            res.status(err.statusCode).json({ message: err.message });
            return;
        }
        throw err;
    }
}
