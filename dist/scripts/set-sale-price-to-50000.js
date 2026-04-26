"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const mongoose_1 = __importDefault(require("mongoose"));
const database_1 = require("../config/database");
const service_model_1 = require("../models/service.model");
dotenv_1.default.config();
async function setSalePriceToFiftyThousand() {
    await (0, database_1.connectDatabase)();
    const result = await service_model_1.Service.updateMany({ listingType: "sale" }, { $set: { price: 50000 } });
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
    await mongoose_1.default.connection.close();
});
