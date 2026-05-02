"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cart = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const cartItemSchema = new mongoose_1.default.Schema({
    serviceId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "Service",
        required: true,
    },
    quantity: { type: Number, required: true, min: 1 },
}, { _id: false });
const cartSchema = new mongoose_1.default.Schema({
    userId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
        index: true,
    },
    items: { type: [cartItemSchema], default: [] },
}, { timestamps: true });
exports.Cart = mongoose_1.default.model("Cart", cartSchema);
