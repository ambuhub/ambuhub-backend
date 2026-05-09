import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDatabase } from "../config/database";
import { Service } from "../models/service.model";
import { ServiceCategory } from "../models/serviceCategory.model";

dotenv.config();

const EXCLUDED_CATEGORY_SLUGS = new Set([
  "personnel",
  "ambulance-servicing",
  "medical-transport",
]);
const MEDICAL_TRANSPORT_SLUG = "medical-transport";
const VALID_LISTING_TYPES = new Set(["sale", "hire", "book"]);

async function backfillListingType(): Promise<void> {
  await connectDatabase();

  const categories = await ServiceCategory.find(
    {},
    "_id slug",
  ).lean<{ _id: mongoose.Types.ObjectId; slug: string }[]>();

  const eligibleCategoryIds = categories
    .filter((category) => !EXCLUDED_CATEGORY_SLUGS.has(category.slug))
    .map((category) => category._id);

  if (eligibleCategoryIds.length === 0) {
    console.log("No eligible categories found. Nothing to update.");
    return;
  }

  const docsToUpdate = await Service.find(
    {
      serviceCategoryId: { $in: eligibleCategoryIds },
      $or: [
        { listingType: { $exists: false } },
        { listingType: null },
        { listingType: { $nin: ["sale", "hire", "book"] } },
      ],
    },
    "_id listingType createdAt",
  )
    .sort({ createdAt: 1 })
    .lean<{ _id: mongoose.Types.ObjectId }[]>();

  if (docsToUpdate.length === 0) {
    console.log("No services needed backfill. All eligible listings already have listingType.");
    return;
  }

  const saleIds: mongoose.Types.ObjectId[] = [];
  const hireIds: mongoose.Types.ObjectId[] = [];

  docsToUpdate.forEach((doc, index) => {
    if (index % 2 === 0) {
      saleIds.push(doc._id);
    } else {
      hireIds.push(doc._id);
    }
  });

  const saleResult =
    saleIds.length > 0
      ? await Service.updateMany(
          { _id: { $in: saleIds } },
          { $set: { listingType: "sale" } },
        )
      : { modifiedCount: 0 };

  const hireResult =
    hireIds.length > 0
      ? await Service.updateMany(
          { _id: { $in: hireIds } },
          { $set: { listingType: "hire" } },
        )
      : { modifiedCount: 0 };

  console.log("Backfill complete.");
  console.log(`Eligible services updated: ${docsToUpdate.length}`);
  console.log(`Set to sale: ${saleResult.modifiedCount}`);
  console.log(`Set to hire: ${hireResult.modifiedCount}`);

  const mtCat = await ServiceCategory.findOne(
    { slug: MEDICAL_TRANSPORT_SLUG },
    "_id",
  ).lean<{ _id: mongoose.Types.ObjectId } | null>();
  if (mtCat?._id) {
    const mtResult = await Service.updateMany(
      {
        serviceCategoryId: mtCat._id,
        $or: [
          { listingType: { $exists: false } },
          { listingType: null },
          { listingType: { $ne: "hire" } },
        ],
      },
      { $set: { listingType: "hire" } },
    );
    console.log(
      `Medical transport default hire: matched ${mtResult.matchedCount}, modified ${mtResult.modifiedCount}`,
    );
  }
}

backfillListingType()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
