/**
 * One-off: migrate listing types from legacy values to sale/hire/book.
 *
 * - listingType "rent" -> "hire"
 * - listingType null (and missing) for personnel / ambulance-servicing -> "book"
 * - all services in medical-transport category -> "hire"
 *
 * Usage: npm run migrate:listing-types-sale-hire-book
 * Requires DB_URI (and optional DB_NAME) in .env
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDatabase } from "../config/database";
import { Service } from "../models/service.model";
import { ServiceCategory } from "../models/serviceCategory.model";

dotenv.config();

const BOOK_CATEGORY_SLUGS = ["personnel", "ambulance-servicing"];
const MEDICAL_TRANSPORT_SLUG = "medical-transport";

async function main(): Promise<void> {
  await connectDatabase();

  const categories = await ServiceCategory.find(
    { slug: { $in: BOOK_CATEGORY_SLUGS } },
    "_id slug",
  ).lean<{ _id: mongoose.Types.ObjectId; slug: string }[]>();
  const bookCategoryIds = categories.map((c) => c._id);

  const rentToHire = await Service.updateMany(
    { listingType: "rent" },
    { $set: { listingType: "hire" } },
  );

  const bookResult =
    bookCategoryIds.length > 0
      ? await Service.updateMany(
          {
            serviceCategoryId: { $in: bookCategoryIds },
            $or: [
              { listingType: { $exists: false } },
              { listingType: null },
              { listingType: { $ne: "book" } },
            ],
          },
          { $set: { listingType: "book" } },
        )
      : { matchedCount: 0, modifiedCount: 0 };

  const mtCat = await ServiceCategory.findOne(
    { slug: MEDICAL_TRANSPORT_SLUG },
    "_id",
  ).lean<{ _id: mongoose.Types.ObjectId } | null>();

  /** Every service in medical-transport must be hire (including sale/book/null). */
  const medicalTransportResult =
    mtCat?._id
      ? await Service.updateMany(
          { serviceCategoryId: mtCat._id },
          { $set: { listingType: "hire" } },
        )
      : { matchedCount: 0, modifiedCount: 0 };

  console.log("migrate-listing-types-sale-hire-book complete.");
  console.log(`Rent -> hire: matched ${rentToHire.matchedCount}, modified ${rentToHire.modifiedCount}`);
  console.log(`Set book for target categories: matched ${bookResult.matchedCount}, modified ${bookResult.modifiedCount}`);
  console.log(
    `Medical transport -> hire: matched ${medicalTransportResult.matchedCount}, modified ${medicalTransportResult.modifiedCount}`,
  );
}

main()
  .catch((error) => {
    console.error("migrate-listing-types-sale-hire-book failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });

