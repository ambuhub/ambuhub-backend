"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Order = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const pricingPeriodValues = ["hourly", "daily", "weekly", "monthly", "yearly"];
const lineKindValues = ["sale", "hire"];
const orderLineSchema = new mongoose_1.default.Schema({
    serviceId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "Service",
        required: true,
    },
    /** Listing owner at checkout; used for reporting when the service row is deleted. */
    sellerUserId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: false,
    },
    lineKind: {
        type: String,
        enum: lineKindValues,
        required: false,
    },
    title: { type: String, required: true },
    unitPriceNgn: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    lineTotalNgn: { type: Number, required: true, min: 0 },
    categoryName: { type: String, required: true },
    categorySlug: { type: String, required: true },
    departmentName: { type: String, required: true },
    hireStart: { type: Date, required: false },
    hireEnd: { type: Date, required: false },
    pricingPeriod: {
        type: String,
        enum: [...pricingPeriodValues],
        required: false,
    },
    hireBillableUnits: { type: Number, required: false, min: 1 },
}, { _id: false });
const orderSchema = new mongoose_1.default.Schema({
    userId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    receiptNumber: { type: String, required: true, unique: true, index: true },
    currency: { type: String, required: true, default: "NGN" },
    subtotalNgn: { type: Number, required: true, min: 0 },
    lines: { type: [orderLineSchema], required: true },
    paymentProvider: {
        type: String,
        required: true,
        enum: ["paystack_simulated"],
    },
    paystackReference: { type: String, required: true },
    paystackSimulated: { type: Boolean, required: true, default: true },
    paidAt: { type: Date, required: true },
}, { timestamps: true });
orderSchema.index({ userId: 1, createdAt: -1 });
exports.Order = mongoose_1.default.model("Order", orderSchema);
