/**
 * One-off: set lines.sellerUserId on orders and receipts from Service.userId
 * when missing, so provider sales charts work after listings are deleted.
 *
 * Usage: npm run migrate:order-line-seller-user-id
 * Requires DB_URI (and optional DB_NAME) in .env
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import { Order } from "../models/order.model";
import { Receipt } from "../models/receipt.model";
import { Service } from "../models/service.model";

dotenv.config();

type LeanLine = {
  serviceId: mongoose.Types.ObjectId;
  sellerUserId?: mongoose.Types.ObjectId | null;
  title: string;
  unitPriceNgn: number;
  quantity: number;
  lineTotalNgn: number;
  categoryName: string;
  categorySlug?: string;
  departmentName: string;
};

function lineNeedsSeller(l: LeanLine): boolean {
  return l.sellerUserId == null;
}

async function backfillLines(
  lines: LeanLine[],
  collectionLabel: string,
  docId: string,
): Promise<LeanLine[] | null> {
  const missing = lines.filter(lineNeedsSeller);
  if (missing.length === 0) {
    return null;
  }
  const uniqueIds = [
    ...new Map(missing.map((l) => [l.serviceId.toString(), l.serviceId])).values(),
  ];
  const svcs = await Service.find({ _id: { $in: uniqueIds } })
    .select("_id userId")
    .lean();
  const sellerByService = new Map<string, mongoose.Types.ObjectId>();
  for (const s of svcs) {
    const uid = s.userId as mongoose.Types.ObjectId | undefined;
    if (uid) {
      sellerByService.set((s._id as mongoose.Types.ObjectId).toString(), uid);
    }
  }

  let changed = false;
  const next = lines.map((l) => {
    if (!lineNeedsSeller(l)) {
      return l;
    }
    const uid = sellerByService.get(l.serviceId.toString());
    if (!uid) {
      console.warn(
        `${collectionLabel} ${docId}: no service or userId for serviceId`,
        l.serviceId.toString(),
      );
      return l;
    }
    changed = true;
    return { ...l, sellerUserId: uid };
  });
  return changed ? next : null;
}

async function main(): Promise<void> {
  const mongoUri = process.env.DB_URI;
  if (!mongoUri) {
    throw new Error("Set DB_URI in .env");
  }

  await mongoose.connect(mongoUri, {
    dbName: process.env.DB_NAME,
    family: 4,
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
  });

  let ordersUpdated = 0;
  const orderCursor = Order.find({}).lean().cursor();
  for await (const doc of orderCursor) {
    const lines = (Array.isArray(doc.lines) ? doc.lines : []) as LeanLine[];
    if (!lines.some(lineNeedsSeller)) {
      continue;
    }
    const next = await backfillLines(
      lines,
      "order",
      (doc._id as mongoose.Types.ObjectId).toString(),
    );
    if (next) {
      await Order.updateOne(
        { _id: doc._id as mongoose.Types.ObjectId },
        { $set: { lines: next } },
      );
      ordersUpdated += 1;
    }
  }

  let receiptsUpdated = 0;
  const receiptCursor = Receipt.find({}).lean().cursor();
  for await (const doc of receiptCursor) {
    const lines = (Array.isArray(doc.lines) ? doc.lines : []) as LeanLine[];
    if (!lines.some(lineNeedsSeller)) {
      continue;
    }
    const next = await backfillLines(
      lines,
      "receipt",
      (doc._id as mongoose.Types.ObjectId).toString(),
    );
    if (next) {
      await Receipt.updateOne(
        { _id: doc._id as mongoose.Types.ObjectId },
        { $set: { lines: next } },
      );
      receiptsUpdated += 1;
    }
  }

  console.log(
    "migrate-order-line-seller-user-id: orders updated",
    ordersUpdated,
    "receipts updated",
    receiptsUpdated,
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
