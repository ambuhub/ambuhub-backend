"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const serviceCategories_controller_1 = require("./serviceCategories.controller");
const router = (0, express_1.Router)();
router.get("/", serviceCategories_controller_1.listServiceCategoriesHandler);
router.get("/:slug", serviceCategories_controller_1.getServiceCategoryBySlugHandler);
exports.default = router;
