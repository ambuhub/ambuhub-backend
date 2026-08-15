/**
 * One-off: set emailVerified to true for all users that are not already verified.
 *
 * Usage: npm run backfill:email-verified
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
    { emailVerified: { $ne: true } },
    { $set: { emailVerified: true } },
  );

  console.log(
    "backfill-email-verified-true: matched",
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
