"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupRoutes = void 0;
const auth_routes_1 = __importDefault(require("../modules/auth/auth.routes"));
const cart_routes_1 = __importDefault(require("../modules/cart/cart.routes"));
const countryCodes_routes_1 = __importDefault(require("../modules/countryCodes/countryCodes.routes"));
const orders_routes_1 = __importStar(require("../modules/orders/orders.routes"));
const serviceCategories_routes_1 = __importDefault(require("../modules/serviceCategories/serviceCategories.routes"));
const services_routes_1 = __importDefault(require("../modules/services/services.routes"));
const uploads_routes_1 = __importDefault(require("../modules/uploads/uploads.routes"));
const wallet_routes_1 = __importDefault(require("../modules/wallet/wallet.routes"));
const setupRoutes = (app) => {
    app.get("/health", (_req, res) => {
        res.status(200).json({ ok: true });
    });
    app.use("/api/auth", auth_routes_1.default);
    app.use("/api/cart", cart_routes_1.default);
    app.use("/api/country-codes", countryCodes_routes_1.default);
    app.use("/api/orders", orders_routes_1.default);
    app.use("/api/receipts", orders_routes_1.receiptsRouter);
    app.use("/api/service-categories", serviceCategories_routes_1.default);
    app.use("/api/services", services_routes_1.default);
    app.use("/api/uploads", uploads_routes_1.default);
    app.use("/api/wallet", wallet_routes_1.default);
};
exports.setupRoutes = setupRoutes;
