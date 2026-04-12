"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Service = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const serviceSchema = new mongoose_1.default.Schema({
    title: { type: String, required: true, trim: true },
    userId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    serviceCategoryId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "ServiceCategory",
        required: true,
        index: true,
    },
    departmentSlug: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    photoUrls: { type: [String], default: [] },
}, { timestamps: true });
serviceSchema.index({ userId: 1, createdAt: -1 });
exports.Service = mongoose_1.default.model("Service", serviceSchema, "services");
