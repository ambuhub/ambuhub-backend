import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDatabase } from "../config/database";

dotenv.config();

/**
 * Migrates legacy `name` field to `firstName` + `lastName`.
 * Run once after deploying the user schema change.
 */
async function migrateUserNameToFirstLast(): Promise<void> {
  await connectDatabase();

  const db = mongoose.connection.db;
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
    const raw = String((doc as { name?: string }).name ?? "").trim();
    const parts = raw.split(/\s+/).filter(Boolean);
    const firstName = parts[0] || "User";
    const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "-";

    await coll.updateOne(
      { _id: doc._id },
      { $set: { firstName, lastName }, $unset: { name: "" } },
    );
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
    void mongoose.disconnect();
  });
