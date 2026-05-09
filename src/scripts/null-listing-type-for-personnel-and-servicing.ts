import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDatabase } from "../config/database";
import { Service } from "../models/service.model";
import { ServiceCategory } from "../models/serviceCategory.model";

dotenv.config();

const TARGET_CATEGORY_SLUGS = ["personnel", "ambulance-servicing"];

async function setListingTypeToBookForTargetCategories(): Promise<void> {
  await connectDatabase();

  const categories = await ServiceCategory.find(
    { slug: { $in: TARGET_CATEGORY_SLUGS } },
    "_id slug",
  ).lean<{ _id: mongoose.Types.ObjectId; slug: string }[]>();

  const categoryIds = categories.map((category) => category._id);

  if (categoryIds.length === 0) {
    console.log("No target categories found. Nothing to update.");
    return;
  }

  const result = await Service.updateMany(
    {
      serviceCategoryId: { $in: categoryIds },
      $or: [
        { listingType: { $exists: false } },
        { listingType: null },
        { listingType: { $ne: "book" } },
      ],
    },
    {
      $set: { listingType: "book" },
    },
  );

  console.log("Book listingType migration complete.");
  console.log(`Matched services: ${result.matchedCount}`);
  console.log(`Modified services: ${result.modifiedCount}`);
}

setListingTypeToBookForTargetCategories()
  .catch((error) => {
    console.error("Book listingType migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
