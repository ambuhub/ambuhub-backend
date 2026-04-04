"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const service_controller_1 = require("./service.controller");
const router = (0, express_1.Router)();
router.get("/", service_controller_1.listServicesHandler);
router.get("/:slug", service_controller_1.getServiceBySlugHandler);
exports.default = router;
