"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Receipt = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
/**
 * Immutable receipt snapshot tied to a paid order.
 * Kept separate from {@link Order} so receipts can be extended (PDF URL, email sent, etc.)
 * without growing the orders collection query patterns.
 */
const receiptLineSchema = new mongoose_1.default.Schema({
    serviceId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "Service",
        required: true,
    },
    title: { type: String, required: true },
    unitPriceNgn: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    lineTotalNgn: { type: Number, required: true, min: 0 },
    categoryName: { type: String, required: true },
    departmentName: { type: String, required: true },
}, { _id: false });
const receiptSchema = new mongoose_1.default.Schema({
    orderId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "Order",
        required: true,
        unique: true,
        index: true,
    },
    userId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    receiptNumber: { type: String, required: true, unique: true, index: true },
    currency: { type: String, required: true, default: "NGN" },
    subtotalNgn: { type: Number, required: true, min: 0 },
    lines: { type: [receiptLineSchema], required: true },
    paymentProvider: { type: String, required: true },
    paystackReference: { type: String, required: true },
    issuedAt: { type: Date, required: true },
}, { timestamps: true });
receiptSchema.index({ userId: 1, issuedAt: -1 });
exports.Receipt = mongoose_1.default.model("Receipt", receiptSchema);
