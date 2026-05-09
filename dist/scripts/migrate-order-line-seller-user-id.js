"use strict";
/**
 * One-off: set lines.sellerUserId on orders and receipts from Service.userId
 * when missing, so provider sales charts work after listings are deleted.
 *
 * Usage: npm run migrate:order-line-seller-user-id
 * Requires DB_URI (and optional DB_NAME) in .env
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const mongoose_1 = __importDefault(require("mongoose"));
const order_model_1 = require("../models/order.model");
const receipt_model_1 = require("../models/receipt.model");
const service_model_1 = require("../models/service.model");
dotenv_1.default.config();
function lineNeedsSeller(l) {
    return l.sellerUserId == null;
}
async function backfillLines(lines, collectionLabel, docId) {
    const missing = lines.filter(lineNeedsSeller);
    if (missing.length === 0) {
        return null;
    }
    const uniqueIds = [
        ...new Map(missing.map((l) => [l.serviceId.toString(), l.serviceId])).values(),
    ];
    const svcs = await service_model_1.Service.find({ _id: { $in: uniqueIds } })
        .select("_id userId")
        .lean();
    const sellerByService = new Map();
    for (const s of svcs) {
        const uid = s.userId;
        if (uid) {
            sellerByService.set(s._id.toString(), uid);
        }
    }
    let changed = false;
    const next = lines.map((l) => {
        if (!lineNeedsSeller(l)) {
            return l;
        }
        const uid = sellerByService.get(l.serviceId.toString());
        if (!uid) {
            console.warn(`${collectionLabel} ${docId}: no service or userId for serviceId`, l.serviceId.toString());
            return l;
        }
        changed = true;
        return { ...l, sellerUserId: uid };
    });
    return changed ? next : null;
}
async function main() {
    const mongoUri = process.env.DB_URI;
    if (!mongoUri) {
        throw new Error("Set DB_URI in .env");
    }
    await mongoose_1.default.connect(mongoUri, {
        dbName: process.env.DB_NAME,
        family: 4,
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 5000,
    });
    let ordersUpdated = 0;
    const orderCursor = order_model_1.Order.find({}).lean().cursor();
    for await (const doc of orderCursor) {
        const lines = (Array.isArray(doc.lines) ? doc.lines : []);
        if (!lines.some(lineNeedsSeller)) {
            continue;
        }
        const next = await backfillLines(lines, "order", doc._id.toString());
        if (next) {
            await order_model_1.Order.updateOne({ _id: doc._id }, { $set: { lines: next } });
            ordersUpdated += 1;
        }
    }
    let receiptsUpdated = 0;
    const receiptCursor = receipt_model_1.Receipt.find({}).lean().cursor();
    for await (const doc of receiptCursor) {
        const lines = (Array.isArray(doc.lines) ? doc.lines : []);
        if (!lines.some(lineNeedsSeller)) {
            continue;
        }
        const next = await backfillLines(lines, "receipt", doc._id.toString());
        if (next) {
            await receipt_model_1.Receipt.updateOne({ _id: doc._id }, { $set: { lines: next } });
            receiptsUpdated += 1;
        }
    }
    console.log("migrate-order-line-seller-user-id: orders updated", ordersUpdated, "receipts updated", receiptsUpdated);
    await mongoose_1.default.disconnect();
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
