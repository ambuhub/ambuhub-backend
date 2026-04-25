import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDatabase } from "../config/database";
import { Service } from "../models/service.model";

dotenv.config();

async function setSaleStockToTen(): Promise<void> {
  await connectDatabase();

  const result = await Service.updateMany(
    { listingType: "sale" },
    { $set: { stock: 10 } },
  );

  console.log("Sale stock backfill complete.");
  console.log(`Matched services: ${result.matchedCount}`);
  console.log(`Modified services: ${result.modifiedCount}`);
}

setSaleStockToTen()
  .catch((error) => {
    console.error("Sale stock backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
