"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeCountryCode = normalizeCountryCode;
exports.isValidCountryCode = isValidCountryCode;
const world_countries_1 = __importDefault(require("world-countries"));
const VALID_ALPHA2 = new Set(world_countries_1.default
    .filter((c) => typeof c.cca2 === "string" && c.cca2.length === 2)
    .map((c) => c.cca2.toUpperCase()));
/**
 * Returns uppercase ISO 3166-1 alpha-2 if valid, otherwise null.
 */
function normalizeCountryCode(input) {
    const t = input?.trim().toUpperCase() ?? "";
    if (!t || !/^[A-Z]{2}$/.test(t)) {
        return null;
    }
    if (!VALID_ALPHA2.has(t)) {
        return null;
    }
    return t;
}
/** True if `input` is a known ISO 3166-1 alpha-2 code (any case, surrounding space ignored). */
function isValidCountryCode(input) {
    return normalizeCountryCode(input) !== null;
}
