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
const serviceProvider_model_1 = require("../../models/serviceProvider.model");
const logger_1 = require("../../shared/lib/logger");
const countryCode_1 = require("../../shared/lib/countryCode");
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
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        dateOfBirth: user.dateOfBirth != null
            ? new Date(user.dateOfBirth).toISOString().slice(0, 10)
            : null,
    };
}
const MIN_AGE_YEARS = 13;
function parseClientDateOfBirth(raw) {
    const trimmed = raw?.trim() ?? "";
    if (!trimmed) {
        throw new AuthHttpError(400, "Date of birth is required");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        throw new AuthHttpError(400, "Invalid date of birth");
    }
    const [y, m, d] = trimmed.split("-").map(Number);
    const utc = new Date(Date.UTC(y, m - 1, d));
    if (utc.getUTCFullYear() !== y ||
        utc.getUTCMonth() !== m - 1 ||
        utc.getUTCDate() !== d) {
        throw new AuthHttpError(400, "Invalid date of birth");
    }
    const today = new Date();
    const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    if (utc.getTime() > todayUtc) {
        throw new AuthHttpError(400, "Date of birth cannot be in the future");
    }
    const minCalendar = Date.UTC(1900, 0, 1);
    if (utc.getTime() < minCalendar) {
        throw new AuthHttpError(400, "Invalid date of birth");
    }
    const cutoff = new Date(today);
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - MIN_AGE_YEARS);
    const cutoffUtc = Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth(), cutoff.getUTCDate());
    if (utc.getTime() > cutoffUtc) {
        throw new AuthHttpError(400, `You must be at least ${MIN_AGE_YEARS} years old to register`);
    }
    return utc;
}
async function register(input) {
    const { firstName, lastName, email, phone, countryCode, password, role, businessName, website, physicalAddress, dateOfBirth, } = input;
    if (!firstName?.trim() ||
        !lastName?.trim() ||
        !email?.trim() ||
        !phone?.trim() ||
        !countryCode?.trim()) {
        throw new AuthHttpError(400, "All fields are required");
    }
    if (!password || password.length < 8) {
        throw new AuthHttpError(400, "Password must be at least 8 characters");
    }
    if (role !== "client" && role !== "service_provider") {
        throw new AuthHttpError(400, "Invalid role");
    }
    const normalizedCountryCode = (0, countryCode_1.normalizeCountryCode)(countryCode);
    if (!normalizedCountryCode) {
        throw new AuthHttpError(400, "Country must be a valid ISO 3166-1 alpha-2 code");
    }
    let parsedDateOfBirth = null;
    if (role === "client") {
        parsedDateOfBirth = parseClientDateOfBirth(dateOfBirth ?? "");
    }
    if (role === "service_provider") {
        if (!businessName?.trim() || !physicalAddress?.trim()) {
            throw new AuthHttpError(400, "Business name and physical address are required for service providers");
        }
    }
    const passwordHash = await bcrypt_1.default.hash(password, SALT_ROUNDS);
    let user;
    try {
        user = await user_model_1.User.create({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            countryCode: normalizedCountryCode,
            password: passwordHash,
            role,
            emailVerified: false,
            dateOfBirth: parsedDateOfBirth,
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
    if (role === "service_provider") {
        const websiteTrimmed = website?.trim() ?? "";
        try {
            await serviceProvider_model_1.ServiceProvider.create({
                userId: user._id,
                businessName: businessName.trim(),
                physicalAddress: physicalAddress.trim(),
                ...(websiteTrimmed ? { website: websiteTrimmed } : {}),
            });
        }
        catch (err) {
            await user_model_1.User.findByIdAndDelete(user._id);
            logger_1.logger.error("service provider profile create failed; user rolled back", {
                error: err,
                userId: user._id.toString(),
            });
            throw new AuthHttpError(500, "Could not complete service provider signup");
        }
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
