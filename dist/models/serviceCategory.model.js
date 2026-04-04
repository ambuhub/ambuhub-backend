"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceCategory = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const departmentSchema = new mongoose_1.default.Schema({
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    order: { type: Number, required: true, default: 0 },
}, { _id: false });
const serviceCategorySchema = new mongoose_1.default.Schema({
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, unique: true },
    departments: {
        type: [departmentSchema],
        default: [],
    },
}, { timestamps: true });
/** MongoDB collection name: serviceCategories */
exports.ServiceCategory = mongoose_1.default.model("ServiceCategory", serviceCategorySchema, "serviceCategories");
