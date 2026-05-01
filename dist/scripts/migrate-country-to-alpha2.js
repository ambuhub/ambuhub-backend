"use strict";
/**
 * One-off: set User.countryCode (ISO 3166-1 alpha-2, uppercase), migrate legacy
 * `country` or fix values from English common names. Unsets `country` when present.
 * Requires DB_URI (and optional DB_NAME) in .env like the main app.
 *
 * Usage: npm run migrate:country-codes
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const mongoose_1 = __importDefault(require("mongoose"));
const world_countries_1 = __importDefault(require("world-countries"));
const countryCode_1 = require("../shared/lib/countryCode");
dotenv_1.default.config();
function buildNameToCode() {
    const map = new Map();
    for (const c of world_countries_1.default) {
        if (typeof c.cca2 !== "string" || c.cca2.length !== 2)
            continue;
        const code = c.cca2.toUpperCase();
        const key = c.name.common.trim().toLowerCase();
        if (!map.has(key)) {
            map.set(key, code);
        }
    }
    return map;
}
function pickRawCountry(doc) {
    const primary = doc.countryCode;
    const legacy = doc.country;
    if (typeof primary === "string" && primary.trim()) {
        return primary;
    }
    if (typeof legacy === "string" && legacy.trim()) {
        return legacy;
    }
    return undefined;
}
async function main() {
    const mongoUri = process.env.DB_URI;
    if (!mongoUri) {
        throw new Error("Set DB_URI in .env");
    }
    const nameToCode = buildNameToCode();
    await mongoose_1.default.connect(mongoUri, {
        dbName: process.env.DB_NAME,
        family: 4,
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 5000,
    });
    const col = mongoose_1.default.connection.collection("users");
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const cursor = col.find({});
    for await (const doc of cursor) {
        const raw = pickRawCountry(doc);
        if (raw === undefined) {
            skipped += 1;
            continue;
        }
        let finalCode = (0, countryCode_1.normalizeCountryCode)(raw) ?? nameToCode.get(raw.trim().toLowerCase()) ?? null;
        if (!finalCode) {
            console.error("Could not map country for user; fix manually:", doc._id?.toString?.(), JSON.stringify(raw));
            failed += 1;
            continue;
        }
        const d = doc;
        const storedCode = typeof d.countryCode === "string" ? d.countryCode.trim() : "";
        const hasLegacyCountry = d.country !== undefined;
        const needsUpdate = storedCode !== finalCode || hasLegacyCountry;
        if (!needsUpdate) {
            skipped += 1;
            continue;
        }
        await col.updateOne({ _id: doc._id }, { $set: { countryCode: finalCode }, $unset: { country: "" } });
        updated += 1;
    }
    console.log("migrate-country-to-alpha2 done:", { updated, skipped, failed });
    await mongoose_1.default.disconnect();
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
