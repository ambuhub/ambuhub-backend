"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Wallet = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const walletSchema = new mongoose_1.default.Schema({
    userId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
        index: true,
    },
    balanceNgn: { type: Number, required: true, default: 0, min: 0 },
    currency: { type: String, required: true, default: "NGN", trim: true },
}, { timestamps: true });
exports.Wallet = mongoose_1.default.model("Wallet", walletSchema);
