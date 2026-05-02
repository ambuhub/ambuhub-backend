"use strict";
/**
 * One-off: set role from legacy "patient" to "client" for all matching users.
 * Uses the raw MongoDB collection so it works even if the Mongoose schema enum
 * no longer lists "patient".
 *
 * Usage: npm run migrate:patient-to-client
 * Requires DB_URI (and optional DB_NAME) in .env
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const mongoose_1 = __importDefault(require("mongoose"));
dotenv_1.default.config();
async function main() {
    const mongoUri = process.env.DB_URI;
    if (!mongoUri) {
        throw new Error("Set DB_URI in .env");
    }
    await mongoose_1.default.connect(mongoUri, {
        dbName: process.env.DB_NAME,
        family: 4,
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 5000,
    });
    const col = mongoose_1.default.connection.collection("users");
    const result = await col.updateMany({ role: "patient" }, { $set: { role: "client" } });
    console.log("migrate-patient-role-to-client: matched", result.matchedCount, "modified", result.modifiedCount);
    await mongoose_1.default.disconnect();
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
