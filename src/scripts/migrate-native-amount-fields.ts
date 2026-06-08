/**
 * One-off: copy legacy *Ngn amount fields to native names (balance, subtotal, lineTotal).
 * Defaults missing order/receipt currency to NGN for pre-GHS data.
 *
 * Usage: npm run migrate:native-amount-fields
 * Requires DB_URI (and optional DB_NAME) in .env
 *
 * Run after: migrate:dual-wallets
 * Run before: backfill:provider-wallets-from-orders
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import { Order } from "../models/order.model";
import { Receipt } from "../models/receipt.model";
import { Wallet } from "../models/wallet.model";
import { isSupportedCurrency, parseSupportedCurrency } from "../shared/currency/types";

dotenv.config();

type LegacyLine = Record<string, unknown>;

function normalizeLine(line: LegacyLine): { next: LegacyLine; changed: boolean } {
  const next: LegacyLine = { ...line };
  let changed = false;

  const lineTotalNgn = next.lineTotalNgn;
  if (typeof next.lineTotal !== "number" && typeof lineTotalNgn === "number") {
    next.lineTotal = lineTotalNgn;
    delete next.lineTotalNgn;
    changed = true;
  }

  const unitPriceNgn = next.unitPriceNgn;
  if (typeof next.unitPrice !== "number" && typeof unitPriceNgn === "number") {
    next.unitPrice = unitPriceNgn;
    delete next.unitPriceNgn;
    changed = true;
  }

  return { next, changed };
}

function normalizeLines(lines: unknown): { next: LegacyLine[]; changed: boolean } | null {
  if (!Array.isArray(lines)) {
    return null;
  }
  let changed = false;
  const next = lines.map((raw) => {
    const { next: line, changed: lineChanged } = normalizeLine(
      (raw ?? {}) as LegacyLine,
    );
    if (lineChanged) {
      changed = true;
    }
    return line;
  });
  return { next, changed };
}

function normalizeOrderLike(doc: Record<string, unknown>): {
  patch: Record<string, unknown>;
  changed: boolean;
} {
  const patch: Record<string, unknown> = {};
  let changed = false;

  const rawCurrency = doc.currency;
  if (typeof rawCurrency !== "string" || !isSupportedCurrency(rawCurrency.trim().toUpperCase())) {
    patch.currency = "NGN";
    changed = true;
  }

  const subtotalNgn = doc.subtotalNgn;
  const subtotal = doc.subtotal;
  if (typeof subtotal !== "number" && typeof subtotalNgn === "number") {
    patch.subtotal = subtotalNgn;
    patch.subtotalNgn = undefined;
    changed = true;
  } else if (typeof doc.subtotalNgn !== "undefined") {
    patch.subtotalNgn = undefined;
    changed = true;
  }

  const linesResult = normalizeLines(doc.lines);
  if (linesResult?.changed) {
    patch.lines = linesResult.next;
    changed = true;
  }

  return { patch, changed };
}

async function migrateWallets(): Promise<number> {
  let updated = 0;
  const cursor = Wallet.find({}).lean().cursor();

  for await (const doc of cursor) {
    const raw = doc as Record<string, unknown> & {
      _id: mongoose.Types.ObjectId;
      balance?: number;
      balanceNgn?: number;
      currency?: string;
    };

    const patch: Record<string, unknown> = {};
    let changed = false;

    const balanceNgn = raw.balanceNgn;
    const balance = raw.balance;
    if (
      (typeof balance !== "number" || balance === 0) &&
      typeof balanceNgn === "number" &&
      balanceNgn > 0
    ) {
      patch.balance = balanceNgn;
      patch.balanceNgn = undefined;
      changed = true;
    } else if (typeof raw.balanceNgn !== "undefined") {
      patch.balanceNgn = undefined;
      changed = true;
    }

    const currency = parseSupportedCurrency(raw.currency, "NGN");
    if (raw.currency !== currency) {
      patch.currency = currency;
      changed = true;
    }

    if (!changed) {
      continue;
    }

    const unset: Record<string, string> = {};
    if (patch.balanceNgn === undefined && typeof raw.balanceNgn !== "undefined") {
      unset.balanceNgn = "";
      delete patch.balanceNgn;
    }

    await Wallet.updateOne(
      { _id: raw._id },
      {
        $set: Object.fromEntries(
          Object.entries(patch).filter(([, v]) => v !== undefined),
        ),
        ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
      },
    );
    updated += 1;
  }

  return updated;
}

async function migrateOrders(): Promise<number> {
  let updated = 0;
  const cursor = Order.find({}).lean().cursor();

  for await (const doc of cursor) {
    const { patch, changed } = normalizeOrderLike(doc as Record<string, unknown>);
    if (!changed) {
      continue;
    }

    const unset: Record<string, string> = {};
    if (patch.subtotalNgn === undefined && typeof (doc as { subtotalNgn?: unknown }).subtotalNgn !== "undefined") {
      unset.subtotalNgn = "";
      delete patch.subtotalNgn;
    }

    await Order.updateOne(
      { _id: doc._id as mongoose.Types.ObjectId },
      {
        $set: Object.fromEntries(
          Object.entries(patch).filter(([, v]) => v !== undefined),
        ),
        ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
      },
    );
    updated += 1;
  }

  return updated;
}

async function migrateReceipts(): Promise<number> {
  let updated = 0;
  const cursor = Receipt.find({}).lean().cursor();

  for await (const doc of cursor) {
    const { patch, changed } = normalizeOrderLike(doc as Record<string, unknown>);
    if (!changed) {
      continue;
    }

    const unset: Record<string, string> = {};
    if (patch.subtotalNgn === undefined && typeof (doc as { subtotalNgn?: unknown }).subtotalNgn !== "undefined") {
      unset.subtotalNgn = "";
      delete patch.subtotalNgn;
    }

    await Receipt.updateOne(
      { _id: doc._id as mongoose.Types.ObjectId },
      {
        $set: Object.fromEntries(
          Object.entries(patch).filter(([, v]) => v !== undefined),
        ),
        ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
      },
    );
    updated += 1;
  }

  return updated;
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

  const walletsUpdated = await migrateWallets();
  const ordersUpdated = await migrateOrders();
  const receiptsUpdated = await migrateReceipts();

  console.log("migrate-native-amount-fields:");
  console.log("  wallets updated:", walletsUpdated);
  console.log("  orders updated:", ordersUpdated);
  console.log("  receipts updated:", receiptsUpdated);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
