"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceProvider = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const serviceProviderSchema = new mongoose_1.default.Schema({
    userId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
        index: true,
    },
    businessName: { type: String, required: true, trim: true },
    website: { type: String, trim: true },
    physicalAddress: { type: String, required: true, trim: true },
}, { timestamps: true });
exports.ServiceProvider = mongoose_1.default.model("ServiceProvider", serviceProviderSchema, "serviceProviders");
