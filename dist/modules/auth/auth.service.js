"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthHttpError = void 0;
exports.scheduleEmailVerificationOtp = scheduleEmailVerificationOtp;
exports.register = register;
exports.login = login;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_model_1 = require("../../models/user.model");
const logger_1 = require("../../shared/lib/logger");
const SALT_ROUNDS = 10;
const JWT_EXPIRES = "7d";
class AuthHttpError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = "AuthHttpError";
    }
}
exports.AuthHttpError = AuthHttpError;
function requireEnvJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET is not set");
    }
    return secret;
}
/**
 * Reserved for OTP email verification (nodemailer + stored OTP + expiry).
 * Call after successful registration once the flow is implemented.
 */
async function scheduleEmailVerificationOtp(userId, email) {
    logger_1.logger.info("OTP email verification scheduled (not implemented yet)", {
        userId,
        email,
    });
}
function signToken(userId, role) {
    return jsonwebtoken_1.default.sign({ sub: userId, userId, role }, requireEnvJwtSecret(), { expiresIn: JWT_EXPIRES });
}
function toPublicUser(user) {
    return {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
    };
}
async function register(input) {
    const { name, email, phone, country, password, role } = input;
    if (!name?.trim() || !email?.trim() || !phone?.trim() || !country?.trim()) {
        throw new AuthHttpError(400, "All fields are required");
    }
    if (!password || password.length < 8) {
        throw new AuthHttpError(400, "Password must be at least 8 characters");
    }
    if (role !== "patient" && role !== "service_provider") {
        throw new AuthHttpError(400, "Invalid role");
    }
    const passwordHash = await bcrypt_1.default.hash(password, SALT_ROUNDS);
    let user;
    try {
        user = await user_model_1.User.create({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            country: country.trim(),
            password: passwordHash,
            role,
            emailVerified: false,
        });
    }
    catch (err) {
        if (err &&
            typeof err === "object" &&
            "code" in err &&
            err.code === 11000) {
            throw new AuthHttpError(409, "An account with this email already exists");
        }
        throw err;
    }
    await scheduleEmailVerificationOtp(user._id.toString(), user.email);
    const token = signToken(user._id.toString(), user.role);
    return {
        token,
        user: toPublicUser(user),
    };
}
async function login(input) {
    const { email, password } = input;
    if (!email?.trim() || !password) {
        throw new AuthHttpError(400, "Email and password are required");
    }
    const user = await user_model_1.User.findOne({
        email: email.trim().toLowerCase(),
    }).select("+password");
    if (!user) {
        throw new AuthHttpError(401, "Invalid email or password");
    }
    const match = await bcrypt_1.default.compare(password, user.password);
    if (!match) {
        throw new AuthHttpError(401, "Invalid email or password");
    }
    const token = signToken(user._id.toString(), user.role);
    return {
        token,
        user: toPublicUser(user),
    };
}
