"use strict";
/**
 * Under category ambulance-servicing, rename department slug:
 * ambulance-maintenance -> ambulance-servicing (catalog alignment).
 *
 * Usage: npm run migrate:dept-ambulance-maintenance-to-servicing
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
const CATEGORY_SLUG = "ambulance-servicing";
const FROM_DEPT_SLUG = "ambulance-maintenance";
const TO_DEPT_SLUG = "ambulance-servicing";
async function main() {
    await (0, database_1.connectDatabase)();
    const cat = await serviceCategory_model_1.ServiceCategory.findOne({ slug: CATEGORY_SLUG }, "_id").lean();
    if (!cat?._id) {
        console.log("Category not found:", CATEGORY_SLUG);
        return;
    }
    const result = await service_model_1.Service.updateMany({
        serviceCategoryId: cat._id,
        departmentSlug: FROM_DEPT_SLUG,
    }, { $set: { departmentSlug: TO_DEPT_SLUG } });
    console.log("migrate-department-ambulance-maintenance-to-servicing: matched", result.matchedCount, "modified", result.modifiedCount);
}
main()
    .catch((err) => {
    console.error(err);
    process.exitCode = 1;
})
    .finally(async () => {
    await mongoose_1.default.connection.close();
});
