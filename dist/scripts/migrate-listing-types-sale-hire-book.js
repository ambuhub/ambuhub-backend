"use strict";
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
const BOOK_CATEGORY_SLUGS = ["personnel", "ambulance-servicing"];
const MEDICAL_TRANSPORT_SLUG = "medical-transport";
async function main() {
    await (0, database_1.connectDatabase)();
    const categories = await serviceCategory_model_1.ServiceCategory.find({ slug: { $in: BOOK_CATEGORY_SLUGS } }, "_id slug").lean();
    const bookCategoryIds = categories.map((c) => c._id);
    const rentToHire = await service_model_1.Service.updateMany({ listingType: "rent" }, { $set: { listingType: "hire" } });
    const bookResult = bookCategoryIds.length > 0
        ? await service_model_1.Service.updateMany({
            serviceCategoryId: { $in: bookCategoryIds },
            $or: [
                { listingType: { $exists: false } },
                { listingType: null },
                { listingType: { $ne: "book" } },
            ],
        }, { $set: { listingType: "book" } })
        : { matchedCount: 0, modifiedCount: 0 };
    const mtCat = await serviceCategory_model_1.ServiceCategory.findOne({ slug: MEDICAL_TRANSPORT_SLUG }, "_id").lean();
    /** Every service in medical-transport must be hire (including sale/book/null). */
    const medicalTransportResult = mtCat?._id
        ? await service_model_1.Service.updateMany({ serviceCategoryId: mtCat._id }, { $set: { listingType: "hire" } })
        : { matchedCount: 0, modifiedCount: 0 };
    console.log("migrate-listing-types-sale-hire-book complete.");
    console.log(`Rent -> hire: matched ${rentToHire.matchedCount}, modified ${rentToHire.modifiedCount}`);
    console.log(`Set book for target categories: matched ${bookResult.matchedCount}, modified ${bookResult.modifiedCount}`);
    console.log(`Medical transport -> hire: matched ${medicalTransportResult.matchedCount}, modified ${medicalTransportResult.modifiedCount}`);
}
main()
    .catch((error) => {
    console.error("migrate-listing-types-sale-hire-book failed:", error);
    process.exitCode = 1;
})
    .finally(async () => {
    await mongoose_1.default.connection.close();
});
