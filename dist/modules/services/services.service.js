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
        departmentSlug: doc.departmentSlug,
        departmentName,
        category,
        photoUrls: Array.isArray(doc.photoUrls) ? doc.photoUrls : [],
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}
const MARKETPLACE_LISTING_CAP = 200;
async function listMarketplaceServices() {
    const rows = await service_model_1.Service.find({})
        .populate("serviceCategoryId", "name slug departments")
        .sort({ createdAt: -1 })
        .limit(MARKETPLACE_LISTING_CAP)
        .lean();
    return rows.map((doc) => mapLeanServiceToDto(doc));
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
    const { title, description, serviceCategorySlug, departmentSlug, photoUrls = [], } = input;
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
    const normalizedUrls = Array.isArray(photoUrls)
        ? photoUrls.filter((u) => typeof u === "string" && u.trim().length > 0)
        : [];
    const doc = await service_model_1.Service.create({
        title: title.trim(),
        description: description.trim(),
        userId: new mongoose_1.default.Types.ObjectId(userId),
        serviceCategoryId: category._id,
        departmentSlug: departmentSlug.trim(),
        photoUrls: normalizedUrls,
    });
    return doc.toObject();
}
