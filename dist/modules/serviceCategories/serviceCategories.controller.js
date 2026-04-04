"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listServiceCategoriesHandler = listServiceCategoriesHandler;
exports.getServiceCategoryBySlugHandler = getServiceCategoryBySlugHandler;
const logger_1 = require("../../shared/lib/logger");
const serviceCategories_service_1 = require("./serviceCategories.service");
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
