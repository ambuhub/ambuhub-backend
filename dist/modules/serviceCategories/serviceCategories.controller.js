"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postCreateServiceCategoryHandler = postCreateServiceCategoryHandler;
exports.listServiceCategoriesHandler = listServiceCategoriesHandler;
exports.getServiceCategoryBySlugHandler = getServiceCategoryBySlugHandler;
exports.putServiceCategoryBySlugHandler = putServiceCategoryBySlugHandler;
const logger_1 = require("../../shared/lib/logger");
const serviceCategories_service_1 = require("./serviceCategories.service");
/**
 * POST /api/service-categories — create a category not in the code catalog.
 * Body: name (required); optional departments[{ name }], note, thumbnailUrl, bannerUrl.
 * Category and department slugs are generated on the server (client must not send slugs).
 * Rows are stored with catalogManaged: false so startup seed does not delete them.
 * WARNING: No authentication in this version. Lock down before production.
 */
async function postCreateServiceCategoryHandler(req, res) {
    try {
        const body = req.body;
        if (Object.prototype.hasOwnProperty.call(body, "slug")) {
            res.status(400).json({
                message: "slug must not be sent; it is generated from name on the server",
            });
            return;
        }
        const name = body.name;
        const departments = body.departments;
        if (typeof name !== "string") {
            res.status(400).json({ message: "name is required" });
            return;
        }
        if (departments !== undefined &&
            departments !== null &&
            !Array.isArray(departments)) {
            res.status(400).json({ message: "departments must be an array when provided" });
            return;
        }
        const deptList = departments === undefined || departments === null ? [] : departments;
        const parsedDepts = [];
        for (const d of deptList) {
            if (d === null || typeof d !== "object") {
                res.status(400).json({ message: "Each department must be an object" });
                return;
            }
            const o = d;
            if (Object.prototype.hasOwnProperty.call(o, "slug")) {
                res.status(400).json({
                    message: "department slug must not be sent; it is generated from name on the server",
                });
                return;
            }
            if (typeof o.name !== "string") {
                res.status(400).json({ message: "Each department needs a string name" });
                return;
            }
            parsedDepts.push({ name: o.name });
        }
        const input = {
            name,
            departments: parsedDepts,
        };
        if (Object.prototype.hasOwnProperty.call(body, "thumbnailUrl")) {
            const v = body.thumbnailUrl;
            if (v === null) {
                input.thumbnailUrl = null;
            }
            else if (typeof v === "string") {
                input.thumbnailUrl = v;
            }
            else {
                res.status(400).json({ message: "thumbnailUrl must be a string or null" });
                return;
            }
        }
        if (Object.prototype.hasOwnProperty.call(body, "bannerUrl")) {
            const v = body.bannerUrl;
            if (v === null) {
                input.bannerUrl = null;
            }
            else if (typeof v === "string") {
                input.bannerUrl = v;
            }
            else {
                res.status(400).json({ message: "bannerUrl must be a string or null" });
                return;
            }
        }
        if (Object.prototype.hasOwnProperty.call(body, "note")) {
            const v = body.note;
            if (v === null) {
                input.note = null;
            }
            else if (typeof v === "string") {
                input.note = v;
            }
            else {
                res.status(400).json({ message: "note must be a string or null" });
                return;
            }
        }
        const serviceCategory = await (0, serviceCategories_service_1.createServiceCategory)(input);
        res.status(201).json({ serviceCategory });
    }
    catch (err) {
        if (err instanceof serviceCategories_service_1.ServiceCategoryHttpError) {
            res.status(err.statusCode).json({ message: err.message });
            return;
        }
        logger_1.logger.error("create service category failed", { error: err });
        res.status(500).json({ message: "Failed to create service category" });
    }
}
async function listServiceCategoriesHandler(_req, res) {
    try {
        const serviceCategories = await (0, serviceCategories_service_1.listServiceCategories)();
        res.status(200).json({ serviceCategories });
    }
    catch (err) {
        logger_1.logger.error("list service categories failed", { error: err });
        res.status(500).json({ message: "Failed to load service categories" });
    }
}
async function getServiceCategoryBySlugHandler(req, res) {
    try {
        const raw = req.params.slug;
        const slug = Array.isArray(raw) ? raw[0] : raw;
        if (!slug?.trim()) {
            res.status(400).json({ message: "Slug is required" });
            return;
        }
        const serviceCategory = await (0, serviceCategories_service_1.getServiceCategoryBySlug)(slug);
        res.status(200).json({ serviceCategory });
    }
    catch (err) {
        if (err instanceof serviceCategories_service_1.ServiceCategoryHttpError) {
            res.status(err.statusCode).json({ message: err.message });
            return;
        }
        logger_1.logger.error("get service category failed", { error: err });
        res.status(500).json({ message: "Failed to load service category" });
    }
}
/**
 * PUT /api/service-categories/:slug — partial update (thumbnailUrl, bannerUrl, note).
 * WARNING: No authentication in this version. Lock down (secret header, admin
 * role, or network rules) before production.
 */
async function putServiceCategoryBySlugHandler(req, res) {
    try {
        const raw = req.params.slug;
        const slug = Array.isArray(raw) ? raw[0] : raw;
        if (!slug?.trim()) {
            res.status(400).json({ message: "Slug is required" });
            return;
        }
        const body = req.body;
        const input = {};
        if (Object.prototype.hasOwnProperty.call(body, "thumbnailUrl")) {
            const v = body.thumbnailUrl;
            if (v === null) {
                input.thumbnailUrl = null;
            }
            else if (typeof v === "string") {
                input.thumbnailUrl = v;
            }
            else if (v !== undefined) {
                res.status(400).json({ message: "thumbnailUrl must be a string or null" });
                return;
            }
        }
        if (Object.prototype.hasOwnProperty.call(body, "bannerUrl")) {
            const v = body.bannerUrl;
            if (v === null) {
                input.bannerUrl = null;
            }
            else if (typeof v === "string") {
                input.bannerUrl = v;
            }
            else if (v !== undefined) {
                res.status(400).json({ message: "bannerUrl must be a string or null" });
                return;
            }
        }
        if (Object.prototype.hasOwnProperty.call(body, "note")) {
            const v = body.note;
            if (v === null) {
                input.note = null;
            }
            else if (typeof v === "string") {
                input.note = v;
            }
            else if (v !== undefined) {
                res.status(400).json({ message: "note must be a string or null" });
                return;
            }
        }
        const serviceCategory = await (0, serviceCategories_service_1.updateServiceCategoryBySlug)(slug, input);
        res.status(200).json({ serviceCategory });
    }
    catch (err) {
        if (err instanceof serviceCategories_service_1.ServiceCategoryHttpError) {
            res.status(err.statusCode).json({ message: err.message });
            return;
        }
        logger_1.logger.error("update service category failed", { error: err });
        res.status(500).json({ message: "Failed to update service category" });
    }
}
