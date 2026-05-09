"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const mongoose_1 = __importDefault(require("mongoose"));
const database_1 = require("../config/database");
const service_model_1 = require("../models/service.model");
const serviceCategory_model_1 = require("../models/serviceCategory.model");
dotenv_1.default.config();
const EXCLUDED_CATEGORY_SLUGS = new Set([
    "personnel",
    "ambulance-servicing",
    "medical-transport",
]);
const MEDICAL_TRANSPORT_SLUG = "medical-transport";
const VALID_LISTING_TYPES = new Set(["sale", "hire", "book"]);
async function backfillListingType() {
    await (0, database_1.connectDatabase)();
    const categories = await serviceCategory_model_1.ServiceCategory.find({}, "_id slug").lean();
    const eligibleCategoryIds = categories
        .filter((category) => !EXCLUDED_CATEGORY_SLUGS.has(category.slug))
        .map((category) => category._id);
    if (eligibleCategoryIds.length === 0) {
        console.log("No eligible categories found. Nothing to update.");
        return;
    }
    const docsToUpdate = await service_model_1.Service.find({
        serviceCategoryId: { $in: eligibleCategoryIds },
        $or: [
            { listingType: { $exists: false } },
            { listingType: null },
            { listingType: { $nin: ["sale", "hire", "book"] } },
        ],
    }, "_id listingType createdAt")
        .sort({ createdAt: 1 })
        .lean();
    if (docsToUpdate.length === 0) {
        console.log("No services needed backfill. All eligible listings already have listingType.");
        return;
    }
    const saleIds = [];
    const hireIds = [];
    docsToUpdate.forEach((doc, index) => {
        if (index % 2 === 0) {
            saleIds.push(doc._id);
        }
        else {
            hireIds.push(doc._id);
        }
    });
    const saleResult = saleIds.length > 0
        ? await service_model_1.Service.updateMany({ _id: { $in: saleIds } }, { $set: { listingType: "sale" } })
        : { modifiedCount: 0 };
    const hireResult = hireIds.length > 0
        ? await service_model_1.Service.updateMany({ _id: { $in: hireIds } }, { $set: { listingType: "hire" } })
        : { modifiedCount: 0 };
    console.log("Backfill complete.");
    console.log(`Eligible services updated: ${docsToUpdate.length}`);
    console.log(`Set to sale: ${saleResult.modifiedCount}`);
    console.log(`Set to hire: ${hireResult.modifiedCount}`);
    const mtCat = await serviceCategory_model_1.ServiceCategory.findOne({ slug: MEDICAL_TRANSPORT_SLUG }, "_id").lean();
    if (mtCat?._id) {
        const mtResult = await service_model_1.Service.updateMany({
            serviceCategoryId: mtCat._id,
            $or: [
                { listingType: { $exists: false } },
                { listingType: null },
                { listingType: { $ne: "hire" } },
            ],
        }, { $set: { listingType: "hire" } });
        console.log(`Medical transport default hire: matched ${mtResult.matchedCount}, modified ${mtResult.modifiedCount}`);
    }
}
backfillListingType()
    .catch((error) => {
    console.error("Backfill failed:", error);
    process.exitCode = 1;
})
    .finally(async () => {
    await mongoose_1.default.connection.close();
});
