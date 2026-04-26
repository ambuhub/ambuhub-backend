"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const userSchema = new mongoose_1.default.Schema({
    name: { type: String, required: true, trim: true },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    phone: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    password: { type: String, required: true, select: false },
    role: {
        type: String,
        enum: ["client", "service_provider"],
        required: true,
    },
    emailVerified: { type: Boolean, default: false },
}, { timestamps: true });
exports.User = mongoose_1.default.model("User", userSchema);
