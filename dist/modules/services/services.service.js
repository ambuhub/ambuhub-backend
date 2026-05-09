"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServicesHttpError = void 0;
exports.listMarketplaceServices = listMarketplaceServices;
exports.listMyServices = listMyServices;
exports.getMyServiceById = getMyServiceById;
exports.deleteService = deleteService;
exports.createService = createService;
exports.updateService = updateService;
const mongoose_1 = __importDefault(require("mongoose"));
const service_model_1 = require("../../models/service.model");
const serviceCategory_model_1 = require("../../models/serviceCategory.model");
const PERSONNEL_CATEGORY_SLUG = "personnel";
const AMBULANCE_SERVICING_CATEGORY_SLUG = "ambulance-servicing";
const BOOK_LISTING_TYPE_CATEGORY_SLUGS = new Set([
    PERSONNEL_CATEGORY_SLUG,
    AMBULANCE_SERVICING_CATEGORY_SLUG,
]);
const MEDICAL_TRANSPORT_CATEGORY_SLUG = "medical-transport";
const HIRE_LISTING_TYPE_CATEGORY_SLUGS = new Set([MEDICAL_TRANSPORT_CATEGORY_SLUG]);
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
        price: typeof doc.price === "number" ? doc.price : null,
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
async function getMyServiceById(userId, serviceId) {
    const trimmed = serviceId?.trim() ?? "";
    if (!trimmed || !mongoose_1.default.Types.ObjectId.isValid(trimmed)) {
        throw new ServicesHttpError(400, "serviceId must be a valid ObjectId");
    }
    const doc = await service_model_1.Service.findOne({
        _id: new mongoose_1.default.Types.ObjectId(trimmed),
        userId: new mongoose_1.default.Types.ObjectId(userId),
    })
        .populate("serviceCategoryId", "name slug departments")
        .lean();
    if (!doc) {
        throw new ServicesHttpError(404, "Service not found");
    }
    return mapLeanServiceToDto(doc);
}
async function deleteService(userId, serviceId) {
    const trimmed = serviceId?.trim() ?? "";
    if (!trimmed || !mongoose_1.default.Types.ObjectId.isValid(trimmed)) {
        throw new ServicesHttpError(400, "serviceId must be a valid ObjectId");
    }
    const result = await service_model_1.Service.findOneAndDelete({
        _id: new mongoose_1.default.Types.ObjectId(trimmed),
        userId: new mongoose_1.default.Types.ObjectId(userId),
    });
    if (!result) {
        throw new ServicesHttpError(404, "Service not found");
    }
}
function normalizeAndValidateServiceInput(categorySlug, input) {
    const { title, description, departmentSlug, listingType, stock, price, photoUrls = [], } = input;
    if (!title?.trim() ||
        !description?.trim() ||
        !departmentSlug?.trim()) {
        throw new ServicesHttpError(400, "title, description, and departmentSlug are required");
    }
    const normalizedListingType = (() => {
        if (listingType === null || listingType === undefined) {
            return null;
        }
        if (typeof listingType !== "string") {
            throw new ServicesHttpError(400, "listingType must be 'sale', 'hire', or 'book'");
        }
        const trimmed = listingType.trim();
        if (trimmed === "") {
            return null;
        }
        if (trimmed === "sale" || trimmed === "hire" || trimmed === "book") {
            return trimmed;
        }
        throw new ServicesHttpError(400, "listingType must be 'sale', 'hire', or 'book'");
    })();
    const mustUseBookListingType = BOOK_LISTING_TYPE_CATEGORY_SLUGS.has(categorySlug);
    const mustUseHireListingType = HIRE_LISTING_TYPE_CATEGORY_SLUGS.has(categorySlug);
    if (mustUseBookListingType && normalizedListingType !== null && normalizedListingType !== "book") {
        throw new ServicesHttpError(400, "listingType must be 'book' for personnel and ambulance-servicing categories");
    }
    if (mustUseHireListingType && normalizedListingType !== null && normalizedListingType !== "hire") {
        throw new ServicesHttpError(400, "listingType must be 'hire' for medical-transport category");
    }
    if (!mustUseBookListingType && !mustUseHireListingType && normalizedListingType === null) {
        throw new ServicesHttpError(400, "listingType is required and must be 'sale' or 'hire' for this category");
    }
    const effectiveListingType = mustUseBookListingType
        ? "book"
        : mustUseHireListingType
            ? "hire"
            : normalizedListingType;
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
    if (effectiveListingType === "sale" && normalizedStock === null) {
        throw new ServicesHttpError(400, "stock is required when listingType is 'sale'");
    }
    if (effectiveListingType !== "sale" && normalizedStock !== null) {
        throw new ServicesHttpError(400, "stock must be null unless listingType is 'sale'");
    }
    const normalizedPrice = (() => {
        if (price === null || price === undefined) {
            return null;
        }
        if (typeof price !== "number" || !Number.isFinite(price)) {
            throw new ServicesHttpError(400, "price must be a number");
        }
        if (price < 0) {
            throw new ServicesHttpError(400, "price must be a non-negative number");
        }
        return price;
    })();
    if (effectiveListingType === "sale" && normalizedPrice === null) {
        throw new ServicesHttpError(400, "price is required when listingType is 'sale'");
    }
    if (effectiveListingType !== "sale" && normalizedPrice !== null) {
        throw new ServicesHttpError(400, "price must be null unless listingType is 'sale'");
    }
    const normalizedUrls = Array.isArray(photoUrls)
        ? photoUrls.filter((u) => typeof u === "string" && u.trim().length > 0)
        : [];
    return {
        title: title.trim(),
        description: description.trim(),
        departmentSlug: departmentSlug.trim(),
        listingType: effectiveListingType,
        stock: normalizedStock,
        price: normalizedPrice,
        photoUrls: normalizedUrls,
    };
}
async function createService(userId, input) {
    if (!input.serviceCategorySlug?.trim()) {
        throw new ServicesHttpError(400, "serviceCategorySlug is required");
    }
    const category = await serviceCategory_model_1.ServiceCategory.findOne({
        slug: input.serviceCategorySlug.trim(),
    }).lean();
    if (!category) {
        throw new ServicesHttpError(404, "Service category not found");
    }
    const deptSlugs = category.departments.map((d) => d.slug);
    const normalized = normalizeAndValidateServiceInput(category.slug, input);
    if (!deptSlugs.includes(normalized.departmentSlug)) {
        throw new ServicesHttpError(400, "departmentSlug is not valid for this category");
    }
    const doc = await service_model_1.Service.create({
        title: normalized.title,
        description: normalized.description,
        userId: new mongoose_1.default.Types.ObjectId(userId),
        serviceCategoryId: category._id,
        listingType: normalized.listingType,
        stock: normalized.stock,
        price: normalized.price,
        departmentSlug: normalized.departmentSlug,
        photoUrls: normalized.photoUrls,
    });
    return doc.toObject();
}
async function updateService(userId, input) {
    if (!input.serviceId?.trim()) {
        throw new ServicesHttpError(400, "serviceId is required");
    }
    if (!mongoose_1.default.Types.ObjectId.isValid(input.serviceId.trim())) {
        throw new ServicesHttpError(400, "serviceId must be a valid ObjectId");
    }
    if (!input.serviceCategorySlug?.trim()) {
        throw new ServicesHttpError(400, "serviceCategorySlug is required");
    }
    const service = await service_model_1.Service.findById(input.serviceId.trim()).lean();
    if (!service) {
        throw new ServicesHttpError(404, "Service not found");
    }
    if (service.userId.toString() !== userId) {
        throw new ServicesHttpError(403, "You can only update services you created");
    }
    const category = await serviceCategory_model_1.ServiceCategory.findOne({
        slug: input.serviceCategorySlug.trim(),
    }).lean();
    if (!category) {
        throw new ServicesHttpError(404, "Service category not found");
    }
    const normalized = normalizeAndValidateServiceInput(category.slug, input);
    const deptSlugs = category.departments.map((d) => d.slug);
    if (!deptSlugs.includes(normalized.departmentSlug)) {
        throw new ServicesHttpError(400, "departmentSlug is not valid for this category");
    }
    const updated = await service_model_1.Service.findByIdAndUpdate(service._id, {
        title: normalized.title,
        description: normalized.description,
        serviceCategoryId: category._id,
        departmentSlug: normalized.departmentSlug,
        listingType: normalized.listingType,
        stock: normalized.stock,
        price: normalized.price,
        photoUrls: normalized.photoUrls,
    }, { new: true }).lean();
    if (!updated) {
        throw new ServicesHttpError(404, "Service not found");
    }
    const repopulated = await service_model_1.Service.findById(updated._id)
        .populate("serviceCategoryId", "name slug departments")
        .lean();
    if (!repopulated) {
        throw new ServicesHttpError(404, "Service not found");
    }
    return mapLeanServiceToDto(repopulated);
}
