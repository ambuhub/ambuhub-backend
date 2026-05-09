/**
 * Under category ambulance-servicing, rename department slug:
 * ambulance-maintenance -> ambulance-servicing (catalog alignment).
 *
 * Usage: npm run migrate:dept-ambulance-maintenance-to-servicing
 * Requires DB_URI (and optional DB_NAME) in .env
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDatabase } from "../config/database";
import { Service } from "../models/service.model";
import { ServiceCategory } from "../models/serviceCategory.model";

dotenv.config();

const CATEGORY_SLUG = "ambulance-servicing";
const FROM_DEPT_SLUG = "ambulance-maintenance";
const TO_DEPT_SLUG = "ambulance-servicing";

async function main(): Promise<void> {
  await connectDatabase();

  const cat = await ServiceCategory.findOne({ slug: CATEGORY_SLUG }, "_id").lean<{
    _id: mongoose.Types.ObjectId;
  } | null>();

  if (!cat?._id) {
    console.log("Category not found:", CATEGORY_SLUG);
    return;
  }

  const result = await Service.updateMany(
    {
      serviceCategoryId: cat._id,
      departmentSlug: FROM_DEPT_SLUG,
    },
    { $set: { departmentSlug: TO_DEPT_SLUG } },
  );

  console.log(
    "migrate-department-ambulance-maintenance-to-servicing: matched",
    result.matchedCount,
    "modified",
    result.modifiedCount,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
