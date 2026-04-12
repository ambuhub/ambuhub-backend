"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceCategoryHttpError = void 0;
exports.ensureServiceCategoryCatalogSeeded = ensureServiceCategoryCatalogSeeded;
exports.listServiceCategories = listServiceCategories;
exports.getServiceCategoryBySlug = getServiceCategoryBySlug;
const serviceCategory_model_1 = require("../../models/serviceCategory.model");
const logger_1 = require("../../shared/lib/logger");
const serviceCategories_catalog_1 = require("./serviceCategories.catalog");
class ServiceCategoryHttpError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = "ServiceCategoryHttpError";
    }
}
exports.ServiceCategoryHttpError = ServiceCategoryHttpError;
function toDepartmentPayload(departments) {
    return departments.map((d, order) => ({
        name: d.name,
        slug: d.slug,
        order,
    }));
}
/**
 * Upserts the full catalog so the database stays aligned with code.
 * Safe to run on every server start.
 */
async function ensureServiceCategoryCatalogSeeded() {
    for (const item of serviceCategories_catalog_1.SERVICE_CATEGORY_CATALOG) {
        await serviceCategory_model_1.ServiceCategory.findOneAndUpdate({ slug: item.slug }, {
            $set: {
                name: item.name,
                slug: item.slug,
                departments: toDepartmentPayload(item.departments),
            },
        }, { upsert: true, returnDocument: "after" });
    }
    const allowedSlugs = serviceCategories_catalog_1.SERVICE_CATEGORY_CATALOG.map((c) => c.slug);
    const pruneResult = await serviceCategory_model_1.ServiceCategory.deleteMany({
        slug: { $nin: allowedSlugs },
    });
    if (pruneResult.deletedCount > 0) {
        logger_1.logger.info("Removed obsolete service categories not in catalog", {
            deletedCount: pruneResult.deletedCount,
        });
    }
    logger_1.logger.info("Service category catalog seeded", {
        count: serviceCategories_catalog_1.SERVICE_CATEGORY_CATALOG.length,
    });
}
async function listServiceCategories() {
    const rows = await serviceCategory_model_1.ServiceCategory.find().sort({ name: 1 }).lean();
    return rows.map((doc) => ({
        id: doc._id.toString(),
        name: doc.name,
        slug: doc.slug,
        departments: [...doc.departments].sort((a, b) => a.order - b.order),
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    }));
}
async function getServiceCategoryBySlug(slug) {
    const doc = await serviceCategory_model_1.ServiceCategory.findOne({ slug: slug.trim() }).lean();
    if (!doc) {
        throw new ServiceCategoryHttpError(404, "Service category not found");
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
