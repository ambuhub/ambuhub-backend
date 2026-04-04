"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceHttpError = void 0;
exports.ensureServiceCatalogSeeded = ensureServiceCatalogSeeded;
exports.listServices = listServices;
exports.getServiceBySlug = getServiceBySlug;
const service_model_1 = require("../../models/service.model");
const logger_1 = require("../../shared/lib/logger");
const service_catalog_1 = require("./service.catalog");
class ServiceHttpError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = "ServiceHttpError";
    }
}
exports.ServiceHttpError = ServiceHttpError;
function toDepartmentPayload(departments) {
    return departments.map((d, order) => ({
        name: d.name,
        slug: d.slug,
        order,
    }));
}
/**
 * Upserts the full service catalog so the database stays aligned with code.
 * Safe to run on every server start.
 */
async function ensureServiceCatalogSeeded() {
    for (const item of service_catalog_1.SERVICE_CATALOG) {
        await service_model_1.Service.findOneAndUpdate({ slug: item.slug }, {
            $set: {
                name: item.name,
                slug: item.slug,
                departments: toDepartmentPayload(item.departments),
            },
        }, { upsert: true, new: true });
    }
    logger_1.logger.info("Service catalog seeded", { count: service_catalog_1.SERVICE_CATALOG.length });
}
async function listServices() {
    const rows = await service_model_1.Service.find().sort({ name: 1 }).lean();
    return rows.map((doc) => ({
        id: doc._id.toString(),
        name: doc.name,
        slug: doc.slug,
        departments: [...doc.departments].sort((a, b) => a.order - b.order),
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    }));
}
async function getServiceBySlug(slug) {
    const doc = await service_model_1.Service.findOne({ slug: slug.trim() }).lean();
    if (!doc) {
        throw new ServiceHttpError(404, "Service not found");
    }
    return {
        id: doc._id.toString(),
        name: doc.name,
        slug: doc.slug,
        departments: [...doc.departments].sort((a, b) => a.order - b.order),
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}
