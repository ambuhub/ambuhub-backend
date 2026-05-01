"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupRoutes = void 0;
const auth_routes_1 = __importDefault(require("../modules/auth/auth.routes"));
const countryCodes_routes_1 = __importDefault(require("../modules/countryCodes/countryCodes.routes"));
const serviceCategories_routes_1 = __importDefault(require("../modules/serviceCategories/serviceCategories.routes"));
const services_routes_1 = __importDefault(require("../modules/services/services.routes"));
const uploads_routes_1 = __importDefault(require("../modules/uploads/uploads.routes"));
const setupRoutes = (app) => {
    app.get("/health", (_req, res) => {
        res.status(200).json({ ok: true });
    });
    app.use("/api/auth", auth_routes_1.default);
    app.use("/api/country-codes", countryCodes_routes_1.default);
    app.use("/api/service-categories", serviceCategories_routes_1.default);
    app.use("/api/services", services_routes_1.default);
    app.use("/api/uploads", uploads_routes_1.default);
};
exports.setupRoutes = setupRoutes;
