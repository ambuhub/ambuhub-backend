/**
 * One-off data fix for hire listings:
 * - All hire services: stock = 20
 * - medical-transport hires: pricingPeriod = weekly, price in [50_000, 100_000] (stable per _id)
 * - ambulance-equipment hires: pricingPeriod = daily, price in [2_000, 6_000] (stable per _id)
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDatabase } from "../config/database";
import { Service } from "../models/service.model";
import { ServiceCategory } from "../models/serviceCategory.model";

dotenv.config();

const MEDICAL_TRANSPORT_SLUG = "medical-transport";
const AMBULANCE_EQUIPMENT_SLUG = "ambulance-equipment";

function stableIntInRange(min: number, max: number, idHex: string): number {
  const slice = idHex.slice(-8);
  const n = Number.parseInt(slice, 16);
  const span = max - min + 1;
  return min + (Math.abs(n) % span);
}

async function migrate(): Promise<void> {
  await connectDatabase();

  const mtCat = await ServiceCategory.findOne({ slug: MEDICAL_TRANSPORT_SLUG })
    .select("_id slug")
    .lean();
  const eqCat = await ServiceCategory.findOne({ slug: AMBULANCE_EQUIPMENT_SLUG })
    .select("_id slug")
    .lean();

  if (!mtCat) {
    console.warn(`Category not found: ${MEDICAL_TRANSPORT_SLUG} (skipping transport pricing updates)`);
  }
  if (!eqCat) {
    console.warn(`Category not found: ${AMBULANCE_EQUIPMENT_SLUG} (skipping equipment pricing updates)`);
  }

  const stockResult = await Service.updateMany(
    { listingType: "hire" },
    { $set: { stock: 20 } },
  );
  console.log(`Hire stock → 20: matched ${stockResult.matchedCount}, modified ${stockResult.modifiedCount}`);

  let mtUpdated = 0;
  if (mtCat?._id) {
    const cursor = Service.find({
      listingType: "hire",
      serviceCategoryId: mtCat._id,
    })
      .select("_id")
      .cursor();

    for await (const doc of cursor) {
      const id = doc._id as mongoose.Types.ObjectId;
      const price = stableIntInRange(50_000, 100_000, id.toHexString());
      await Service.updateOne(
        { _id: id },
        { $set: { pricingPeriod: "weekly", price, stock: 20 } },
      );
      mtUpdated += 1;
    }
    console.log(`medical-transport hire: updated ${mtUpdated} (weekly, price 50k–100k)`);
  }

  let eqUpdated = 0;
  if (eqCat?._id) {
    const cursor = Service.find({
      listingType: "hire",
      serviceCategoryId: eqCat._id,
    })
      .select("_id")
      .cursor();

    for await (const doc of cursor) {
      const id = doc._id as mongoose.Types.ObjectId;
      const price = stableIntInRange(2_000, 6_000, id.toHexString());
      await Service.updateOne(
        { _id: id },
        { $set: { pricingPeriod: "daily", price, stock: 20 } },
      );
      eqUpdated += 1;
    }
    console.log(`ambulance-equipment hire: updated ${eqUpdated} (daily, price 2k–6k)`);
  }

  console.log("Done.");
}

migrate()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
