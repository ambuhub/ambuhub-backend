/**
 * One-off: set role from legacy "patient" to "client" for all matching users.
 * Uses the raw MongoDB collection so it works even if the Mongoose schema enum
 * no longer lists "patient".
 *
 * Usage: npm run migrate:patient-to-client
 * Requires DB_URI (and optional DB_NAME) in .env
 */

import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

async function main(): Promise<void> {
  const mongoUri = process.env.DB_URI;
  if (!mongoUri) {
    throw new Error("Set DB_URI in .env");
  }

  await mongoose.connect(mongoUri, {
    dbName: process.env.DB_NAME,
    family: 4,
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
  });

  const col = mongoose.connection.collection("users");
  const result = await col.updateMany(
    { role: "patient" },
    { $set: { role: "client" } },
  );

  console.log(
    "migrate-patient-role-to-client: matched",
    result.matchedCount,
    "modified",
    result.modifiedCount,
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
