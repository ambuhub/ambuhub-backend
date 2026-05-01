"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const mongoose_1 = __importDefault(require("mongoose"));
const database_1 = require("../config/database");
dotenv_1.default.config();
/**
 * Migrates legacy `name` field to `firstName` + `lastName`.
 * Run once after deploying the user schema change.
 */
async function migrateUserNameToFirstLast() {
    await (0, database_1.connectDatabase)();
    const db = mongoose_1.default.connection.db;
    if (!db) {
        throw new Error("Database connection has no db handle");
    }
    const coll = db.collection("users");
    const cursor = coll.find({
        firstName: { $exists: false },
        name: { $exists: true, $type: "string" },
    });
    let updated = 0;
    for await (const doc of cursor) {
        const raw = String(doc.name ?? "").trim();
        const parts = raw.split(/\s+/).filter(Boolean);
        const firstName = parts[0] || "User";
        const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "-";
        await coll.updateOne({ _id: doc._id }, { $set: { firstName, lastName }, $unset: { name: "" } });
        updated += 1;
    }
    console.log("User name migration complete.");
    console.log(`Documents updated: ${updated}`);
}
migrateUserNameToFirstLast()
    .catch((error) => {
    console.error("User name migration failed:", error);
    process.exitCode = 1;
})
    .finally(() => {
    void mongoose_1.default.disconnect();
});
