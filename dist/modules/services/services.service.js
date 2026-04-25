"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServicesHttpError = void 0;
exports.listMarketplaceServices = listMarketplaceServices;
exports.listMyServices = listMyServices;
exports.createService = createService;
const mongoose_1 = __importDefault(require("mongoose"));
const service_model_1 = require("../../models/service.model");
const serviceCategory_model_1 = require("../../models/serviceCategory.model");
const PERSONNEL_CATEGORY_SLUG = "personnel";
const AMBULANCE_SERVICING_CATEGORY_SLUG = "ambulance-servicing";
const NULL_LISTING_TYPE_CATEGORY_SLUGS = new Set([
    PERSONNEL_CATEGORY_SLUG,
    AMBULANCE_SERVICING_CATEGORY_SLUG,
]);
class ServicesHttpError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = "ServicesHttpError";
    }
}
exports.ServicesHttpError = ServicesHttpError;
function mapLeanServiceToDto(doc) {
    const cat = doc.serviceCategoryId;
    const deptSlug = doc.departmentSlug;
    let departmentName = deptSlug;
    let category = {
        id: "",
        slug: "unknown",
        name: "Unknown category",
    };
    if (cat && typeof cat === "object" && "_id" in cat) {
        category = {
            id: cat._id.toString(),
            slug: cat.slug,
            name: cat.name,
        };
        const dept = cat.departments.find((d) => d.slug === deptSlug);
        if (dept) {
            departmentName = dept.name;
        }
    }
    return {
        id: doc._id.toString(),
        title: doc.title,
        description: doc.description,
        listingType: doc.listingType ?? null,
        stock: typeof doc.stock === "number" ? doc.stock : null,
        departmentSlug: doc.departmentSlug,
        departmentName,
        category,
        photoUrls: Array.isArray(doc.photoUrls) ? doc.photoUrls : [],
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}
const MARKETPLACE_LISTING_CAP = 200;
async function listMarketplaceServices(categorySlug) {
    let query = {};
    let bannerUrl = null;
    if (categorySlug !== undefined) {
        const trimmed = categorySlug.trim();
        if (!trimmed) {
            throw new ServicesHttpError(400, "categorySlug must be a non-empty string");
        }
        const category = await serviceCategory_model_1.ServiceCategory.findOne({ slug: trimmed }, "_id bannerUrl").lean();
        if (!category) {
            throw new ServicesHttpError(404, "Service category not found");
        }
        const rawBanner = category.bannerUrl;
        bannerUrl =
            typeof rawBanner === "string" && rawBanner.trim() !== ""
                ? rawBanner.trim()
                : null;
        query = { serviceCategoryId: category._id };
    }
    const rows = await service_model_1.Service.find(query)
        .populate("serviceCategoryId", "name slug departments")
        .sort({ createdAt: -1 })
        .limit(MARKETPLACE_LISTING_CAP)
        .lean();
    return {
        services: rows.map((doc) => mapLeanServiceToDto(doc)),
        bannerUrl,
    };
}
async function listMyServices(userId) {
    const rows = await service_model_1.Service.find({
        userId: new mongoose_1.default.Types.ObjectId(userId),
    })
        .populate("serviceCategoryId", "name slug departments")
        .sort({ createdAt: -1 })
        .lean();
    return rows.map((doc) => mapLeanServiceToDto(doc));
}
async function createService(userId, input) {
    const { title, description, serviceCategorySlug, departmentSlug, listingType, stock, photoUrls = [], } = input;
    if (!title?.trim() ||
        !description?.trim() ||
        !serviceCategorySlug?.trim() ||
        !departmentSlug?.trim()) {
        throw new ServicesHttpError(400, "title, description, serviceCategorySlug, and departmentSlug are required");
    }
    const category = await serviceCategory_model_1.ServiceCategory.findOne({
        slug: serviceCategorySlug.trim(),
    }).lean();
    if (!category) {
        throw new ServicesHttpError(404, "Service category not found");
    }
    const deptSlugs = category.departments.map((d) => d.slug);
    if (!deptSlugs.includes(departmentSlug.trim())) {
        throw new ServicesHttpError(400, "departmentSlug is not valid for this category");
    }
    const normalizedListingType = (() => {
        if (listingType === null || listingType === undefined) {
            return null;
        }
        if (typeof listingType !== "string") {
            throw new ServicesHttpError(400, "listingType must be 'sale' or 'rent' for non-personnel categories");
        }
        const trimmed = listingType.trim();
        if (trimmed === "") {
            return null;
        }
        if (trimmed === "sale" || trimmed === "rent") {
            return trimmed;
        }
        throw new ServicesHttpError(400, "listingType must be 'sale' or 'rent' for non-personnel categories");
    })();
    const mustUseNullListingType = NULL_LISTING_TYPE_CATEGORY_SLUGS.has(category.slug);
    if (mustUseNullListingType && normalizedListingType !== null) {
        throw new ServicesHttpError(400, "listingType must be null for personnel and ambulance-servicing categories");
    }
    if (!mustUseNullListingType && normalizedListingType === null) {
        throw new ServicesHttpError(400, "listingType is required and must be 'sale' or 'rent' for this category");
    }
    const normalizedStock = (() => {
        if (stock === null || stock === undefined) {
            return null;
        }
        if (typeof stock !== "number" || !Number.isFinite(stock)) {
            throw new ServicesHttpError(400, "stock must be a number");
        }
        if (!Number.isInteger(stock) || stock < 0) {
            throw new ServicesHttpError(400, "stock must be a non-negative integer");
        }
        return stock;
    })();
    if (normalizedListingType === "sale" && normalizedStock === null) {
        throw new ServicesHttpError(400, "stock is required when listingType is 'sale'");
    }
    if (normalizedListingType !== "sale" && normalizedStock !== null) {
        throw new ServicesHttpError(400, "stock must be null unless listingType is 'sale'");
    }
    const normalizedUrls = Array.isArray(photoUrls)
        ? photoUrls.filter((u) => typeof u === "string" && u.trim().length > 0)
        : [];
    const doc = await service_model_1.Service.create({
        title: title.trim(),
        description: description.trim(),
        userId: new mongoose_1.default.Types.ObjectId(userId),
        serviceCategoryId: category._id,
        listingType: normalizedListingType,
        stock: normalizedStock,
        departmentSlug: departmentSlug.trim(),
        photoUrls: normalizedUrls,
    });
    return doc.toObject();
}
