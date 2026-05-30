/**
 * Backfill missing lineKind on legacy cart/sale order and receipt lines.
 * Run: npm run backfill:order-line-kind-sale
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDatabase } from "../config/database";
import { Order } from "../models/order.model";
import { Receipt } from "../models/receipt.model";

dotenv.config();

type LineShape = {
  lineKind?: string | null;
  hireStart?: Date | null;
  hireEnd?: Date | null;
  hireBillableUnits?: number | null;
  bookStart?: Date | null;
  bookEnd?: Date | null;
  bookBillableUnits?: number | null;
  [key: string]: unknown;
};

function inferBackfillLineKind(line: LineShape): "sale" | "hire" | "book" | null {
  const raw = line.lineKind;
  if (raw === "sale" || raw === "hire" || raw === "book") {
    return null;
  }
  if (
    line.bookStart != null ||
    line.bookEnd != null ||
    typeof line.bookBillableUnits === "number"
  ) {
    return "book";
  }
  if (
    line.hireStart != null ||
    line.hireEnd != null ||
    typeof line.hireBillableUnits === "number"
  ) {
    return "hire";
  }
  return "sale";
}

function backfillLines<T extends LineShape>(lines: T[]): { next: T[]; changed: boolean } {
  let changed = false;
  const next = lines.map((line) => {
    const kind = inferBackfillLineKind(line);
    if (!kind) {
      return line;
    }
    changed = true;
    return { ...line, lineKind: kind };
  });
  return { next, changed };
}

async function main(): Promise<void> {
  await connectDatabase();

  let updatedOrders = 0;
  let updatedReceipts = 0;

  const orders = await Order.find({}).lean();
  for (const order of orders) {
    const lines = Array.isArray(order.lines) ? order.lines : [];
    const { next, changed } = backfillLines(lines as LineShape[]);
    if (!changed) {
      continue;
    }
    await Order.updateOne({ _id: order._id }, { $set: { lines: next } });
    updatedOrders += 1;
  }

  const receipts = await Receipt.find({}).lean();
  for (const receipt of receipts) {
    const lines = Array.isArray(receipt.lines) ? receipt.lines : [];
    const { next, changed } = backfillLines(lines as LineShape[]);
    if (!changed) {
      continue;
    }
    await Receipt.updateOne({ _id: receipt._id }, { $set: { lines: next } });
    updatedReceipts += 1;
  }

  console.log(
    `Backfill complete. Updated ${updatedOrders} order(s) and ${updatedReceipts} receipt(s).`,
  );

  await mongoose.disconnect();
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
