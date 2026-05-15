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
exports.CartHttpError = void 0;
exports.mapServiceToLineMeta = mapServiceToLineMeta;
exports.loadHireServiceForCheckout = loadHireServiceForCheckout;
exports.getCart = getCart;
exports.addCartItem = addCartItem;
exports.setCartItemQuantity = setCartItemQuantity;
exports.removeCartItem = removeCartItem;
exports.resolveCartForCheckout = resolveCartForCheckout;
exports.clearCart = clearCart;
exports.generateUniqueReceiptNumber = generateUniqueReceiptNumber;
exports.generateSimulatedPaystackReference = generateSimulatedPaystackReference;
const mongoose_1 = __importDefault(require("mongoose"));
const cart_model_1 = require("../../models/cart.model");
const service_model_1 = require("../../models/service.model");
const HIRE_PRICING_PERIODS = new Set([
    "hourly",
    "daily",
    "weekly",
    "monthly",
    "yearly",
]);
class CartHttpError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = "CartHttpError";
    }
}
exports.CartHttpError = CartHttpError;
function mapServiceToLineMeta(doc) {
    const cat = doc.serviceCategoryId;
    const deptSlug = doc.departmentSlug;
    let departmentName = deptSlug;
    let category = { slug: "unknown", name: "Unknown" };
    if (cat && typeof cat === "object" && "_id" in cat) {
        category = { slug: cat.slug, name: cat.name };
        const dept = cat.departments.find((d) => d.slug === deptSlug);
        if (dept) {
            departmentName = dept.name;
        }
    }
    const listingType = doc.listingType ?? null;
    const price = typeof doc.price === "number" ? doc.price : null;
    const stock = typeof doc.stock === "number" ? doc.stock : null;
    return {
        serviceId: doc._id.toString(),
        title: doc.title,
        listingType,
        stock,
        price,
        departmentSlug: doc.departmentSlug,
        departmentName,
        category,
        photoUrls: Array.isArray(doc.photoUrls) ? doc.photoUrls : [],
    };
}
async function loadSaleServiceForCart(serviceId, buyerUserId) {
    const trimmed = serviceId?.trim() ?? "";
    if (!trimmed || !mongoose_1.default.Types.ObjectId.isValid(trimmed)) {
        throw new CartHttpError(400, "serviceId must be a valid ObjectId");
    }
    const doc = await service_model_1.Service.findById(trimmed)
        .populate("serviceCategoryId", "name slug departments")
        .lean();
    if (!doc) {
        throw new CartHttpError(404, "Service not found");
    }
    const lean = doc;
    if (lean.userId.toString() === buyerUserId) {
        throw new CartHttpError(400, "You cannot add your own listing to the cart");
    }
    if (lean.listingType !== "sale") {
        throw new CartHttpError(400, "Only sale listings can be added to the cart");
    }
    if (lean.isAvailable === false) {
        throw new CartHttpError(400, "This listing is not available");
    }
    const price = typeof lean.price === "number" ? lean.price : null;
    const stock = typeof lean.stock === "number" ? lean.stock : null;
    if (price === null || price < 0) {
        throw new CartHttpError(400, "This sale listing does not have a valid price");
    }
    if (stock === null || stock < 1) {
        throw new CartHttpError(400, "This listing is out of stock");
    }
    return lean;
}
async function loadHireServiceForCheckout(serviceId, buyerUserId, quantity) {
    const trimmed = serviceId?.trim() ?? "";
    if (!trimmed || !mongoose_1.default.Types.ObjectId.isValid(trimmed)) {
        throw new CartHttpError(400, "serviceId must be a valid ObjectId");
    }
    if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity < 1) {
        throw new CartHttpError(400, "quantity must be a positive integer");
    }
    const doc = await service_model_1.Service.findById(trimmed)
        .populate("serviceCategoryId", "name slug departments")
        .lean();
    if (!doc) {
        throw new CartHttpError(404, "Service not found");
    }
    const lean = doc;
    if (lean.userId.toString() === buyerUserId) {
        throw new CartHttpError(400, "You cannot book your own listing");
    }
    if (lean.listingType !== "hire") {
        throw new CartHttpError(400, "Only hire listings can be booked this way");
    }
    if (lean.isAvailable === false) {
        throw new CartHttpError(400, "This listing is not available");
    }
    const price = typeof lean.price === "number" ? lean.price : null;
    const stock = typeof lean.stock === "number" ? lean.stock : null;
    const rawPeriod = lean.pricingPeriod;
    const pricingPeriod = typeof rawPeriod === "string" && HIRE_PRICING_PERIODS.has(rawPeriod)
        ? rawPeriod
        : null;
    if (price === null || price < 0) {
        throw new CartHttpError(400, "This hire listing does not have a valid price");
    }
    if (pricingPeriod === null) {
        throw new CartHttpError(400, "This hire listing does not have a valid pricing period");
    }
    if (stock === null || stock < 1) {
        throw new CartHttpError(400, "This listing is out of stock");
    }
    if (quantity > stock) {
        throw new CartHttpError(400, "Quantity exceeds available stock");
    }
    return { ...lean, pricingPeriod };
}
async function getCart(userId) {
    const cart = await cart_model_1.Cart.findOne({ userId: new mongoose_1.default.Types.ObjectId(userId) }).lean();
    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
        return { items: [] };
    }
    const lines = [];
    for (const row of cart.items) {
        const sid = row.serviceId?.toString?.() ?? String(row.serviceId);
        try {
            const svc = await loadSaleServiceForCart(sid, userId);
            const meta = mapServiceToLineMeta(svc);
            const qty = typeof row.quantity === "number" && row.quantity >= 1 ? row.quantity : 1;
            const maxQty = meta.stock ?? 0;
            const clamped = Math.min(qty, maxQty);
            const price = meta.price ?? 0;
            lines.push({
                ...meta,
                quantity: clamped,
                lineTotalNgn: price * clamped,
            });
        }
        catch {
            // Stale cart reference (deleted service): skip in response; caller can sync cart later
            continue;
        }
    }
    return { items: lines };
}
async function addCartItem(userId, serviceId, quantityRaw) {
    const svc = await loadSaleServiceForCart(serviceId, userId);
    const stock = typeof svc.stock === "number" ? svc.stock : 0;
    let quantity = 1;
    if (quantityRaw !== undefined && quantityRaw !== null) {
        const n = typeof quantityRaw === "number" ? quantityRaw : Number(quantityRaw);
        if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
            throw new CartHttpError(400, "quantity must be a positive integer");
        }
        quantity = n;
    }
    quantity = Math.min(quantity, stock);
    const uid = new mongoose_1.default.Types.ObjectId(userId);
    const sid = svc._id;
    const cart = await cart_model_1.Cart.findOne({ userId: uid }).lean();
    const items = (cart?.items ?? []).map((i) => ({
        serviceId: new mongoose_1.default.Types.ObjectId(String(i.serviceId)),
        quantity: Number(i.quantity),
    }));
    const idx = items.findIndex((i) => i.serviceId.equals(sid));
    if (idx >= 0) {
        const nextQty = Math.min(items[idx].quantity + quantity, stock);
        items[idx] = { serviceId: sid, quantity: nextQty };
    }
    else {
        items.push({ serviceId: sid, quantity });
    }
    await cart_model_1.Cart.findOneAndUpdate({ userId: uid }, { $set: { items } }, { upsert: true });
    return getCart(userId);
}
async function setCartItemQuantity(userId, serviceId, quantityRaw) {
    const trimmed = serviceId?.trim() ?? "";
    if (!trimmed || !mongoose_1.default.Types.ObjectId.isValid(trimmed)) {
        throw new CartHttpError(400, "serviceId must be a valid ObjectId");
    }
    const n = typeof quantityRaw === "number" ? quantityRaw : Number(quantityRaw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
        throw new CartHttpError(400, "quantity must be a positive integer");
    }
    const svc = await loadSaleServiceForCart(trimmed, userId);
    const stock = typeof svc.stock === "number" ? svc.stock : 0;
    const quantity = Math.min(n, stock);
    const uid = new mongoose_1.default.Types.ObjectId(userId);
    const cart = await cart_model_1.Cart.findOne({ userId: uid }).lean();
    if (!cart) {
        throw new CartHttpError(404, "Cart is empty");
    }
    const items = (cart.items ?? []).map((i) => ({
        serviceId: new mongoose_1.default.Types.ObjectId(String(i.serviceId)),
        quantity: Number(i.quantity),
    }));
    const idx = items.findIndex((i) => i.serviceId.toString() === trimmed);
    if (idx < 0) {
        throw new CartHttpError(404, "Item not in cart");
    }
    items[idx] = { serviceId: items[idx].serviceId, quantity };
    await cart_model_1.Cart.findOneAndUpdate({ userId: uid }, { $set: { items } });
    return getCart(userId);
}
async function removeCartItem(userId, serviceId) {
    const trimmed = serviceId?.trim() ?? "";
    if (!trimmed || !mongoose_1.default.Types.ObjectId.isValid(trimmed)) {
        throw new CartHttpError(400, "serviceId must be a valid ObjectId");
    }
    const uid = new mongoose_1.default.Types.ObjectId(userId);
    const cart = await cart_model_1.Cart.findOne({ userId: uid }).lean();
    if (!cart) {
        return { items: [] };
    }
    const items = (cart.items ?? [])
        .map((i) => ({
        serviceId: new mongoose_1.default.Types.ObjectId(String(i.serviceId)),
        quantity: Number(i.quantity),
    }))
        .filter((i) => i.serviceId.toString() !== trimmed);
    await cart_model_1.Cart.findOneAndUpdate({ userId: uid }, { $set: { items } });
    return getCart(userId);
}
/**
 * Validates cart and returns resolved lines for checkout (does not mutate).
 */
async function resolveCartForCheckout(userId) {
    const cart = await cart_model_1.Cart.findOne({ userId: new mongoose_1.default.Types.ObjectId(userId) }).lean();
    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
        throw new CartHttpError(400, "Your cart is empty");
    }
    const lines = [];
    let subtotal = 0;
    for (const row of cart.items) {
        const sid = row.serviceId?.toString?.() ?? String(row.serviceId);
        const svc = await loadSaleServiceForCart(sid, userId);
        const meta = mapServiceToLineMeta(svc);
        const stock = meta.stock ?? 0;
        const qtyRaw = typeof row.quantity === "number" && row.quantity >= 1 ? row.quantity : 1;
        const qty = Math.min(qtyRaw, stock);
        const unit = meta.price ?? 0;
        const lineTotal = unit * qty;
        subtotal += lineTotal;
        lines.push({
            serviceId: svc._id,
            quantity: qty,
            title: meta.title,
            unitPriceNgn: unit,
            lineTotalNgn: lineTotal,
            categoryName: meta.category.name,
            categorySlug: meta.category.slug,
            departmentName: meta.departmentName,
        });
    }
    if (lines.length === 0) {
        throw new CartHttpError(400, "Your cart is empty");
    }
    return { lines, subtotalNgn: subtotal };
}
async function clearCart(userId) {
    await cart_model_1.Cart.deleteOne({ userId: new mongoose_1.default.Types.ObjectId(userId) });
}
function randomReceiptSuffix() {
    const chars = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let s = "";
    for (let i = 0; i < 6; i += 1) {
        s += chars[Math.floor(Math.random() * chars.length)];
    }
    return s;
}
async function generateUniqueReceiptNumber() {
    const { Order } = await Promise.resolve().then(() => __importStar(require("../../models/order.model")));
    const year = new Date().getUTCFullYear();
    for (let attempt = 0; attempt < 12; attempt += 1) {
        const candidate = `AMB-${year}-${randomReceiptSuffix()}`;
        const exists = await Order.exists({ receiptNumber: candidate });
        if (!exists) {
            return candidate;
        }
    }
    return `AMB-${year}-${Date.now().toString(36).toUpperCase()}`;
}
function generateSimulatedPaystackReference() {
    const t = Date.now().toString(36).toUpperCase();
    const r = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `AMB_SIM_${t}_${r}`;
}
