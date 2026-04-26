import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDatabase } from "../config/database";
import { Service } from "../models/service.model";

dotenv.config();

async function setSalePriceToFiftyThousand(): Promise<void> {
  await connectDatabase();

  const result = await Service.updateMany(
    { listingType: "sale" },
    { $set: { price: 50000 } },
  );

  console.log("Sale price backfill complete.");
  console.log(`Matched services: ${result.matchedCount}`);
  console.log(`Modified services: ${result.modifiedCount}`);
}

setSalePriceToFiftyThousand()
  .catch((error) => {
    console.error("Sale price backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
