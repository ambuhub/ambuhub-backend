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
const TARGET_CATEGORY_SLUGS = ["personnel", "ambulance-servicing"];
async function setListingTypeToBookForTargetCategories() {
    await (0, database_1.connectDatabase)();
    const categories = await serviceCategory_model_1.ServiceCategory.find({ slug: { $in: TARGET_CATEGORY_SLUGS } }, "_id slug").lean();
    const categoryIds = categories.map((category) => category._id);
    if (categoryIds.length === 0) {
        console.log("No target categories found. Nothing to update.");
        return;
    }
    const result = await service_model_1.Service.updateMany({
        serviceCategoryId: { $in: categoryIds },
        $or: [
            { listingType: { $exists: false } },
            { listingType: null },
            { listingType: { $ne: "book" } },
        ],
    }, {
        $set: { listingType: "book" },
    });
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
    await mongoose_1.default.connection.close();
});
