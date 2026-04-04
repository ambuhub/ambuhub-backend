"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Service = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const departmentSchema = new mongoose_1.default.Schema({
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    order: { type: Number, required: true, default: 0 },
}, { _id: false });
const serviceSchema = new mongoose_1.default.Schema({
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, unique: true },
    departments: {
        type: [departmentSchema],
        default: [],
    },
}, { timestamps: true });
serviceSchema.index({ slug: 1 });
exports.Service = mongoose_1.default.model("Service", serviceSchema);
