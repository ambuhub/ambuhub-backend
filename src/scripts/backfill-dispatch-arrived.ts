/**
 * One-off: mark in-progress dispatch requests as arrived (completed).
 * Updates status `accepted` and `en_route` → `arrived`.
 *
 * Usage: npm run backfill:dispatch-arrived
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

  const col = mongoose.connection.collection("ambulance_dispatch_requests");
  const now = new Date();

  const result = await col.updateMany(
    { status: { $in: ["accepted", "en_route"] } },
    {
      $set: {
        status: "arrived",
        arrivedAt: now,
        currentOfferExpiresAt: null,
      },
    },
  );

  console.log(
    "backfill-dispatch-arrived: matched",
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
