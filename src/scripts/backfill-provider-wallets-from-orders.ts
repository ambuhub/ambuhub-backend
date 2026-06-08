/**
 * Rebuild provider wallet balances from paid order line totals per currency.
 * Authoritative replace (not increment) to avoid double-credit after legacy migrations.
 *
 * Usage: npm run backfill:provider-wallets-from-orders
 * Requires DB_URI (and optional DB_NAME) in .env
 *
 * Recommended run order:
 *   npm run migrate:dual-wallets
 *   npm run migrate:native-amount-fields
 *   npm run migrate:order-line-seller-user-id
 *   npm run backfill:provider-wallets-from-orders
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import { Order } from "../models/order.model";
import { ensureWallet } from "../modules/wallet/wallet.service";
import { Wallet } from "../models/wallet.model";
import {
  SUPPORTED_CURRENCIES,
  parseSupportedCurrency,
  type SupportedCurrency,
} from "../shared/currency/types";

dotenv.config();

type WalletTotalRow = {
  _id: {
    sellerUserId: mongoose.Types.ObjectId;
    currency: string;
  };
  total: number;
};

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

  const rows = await Order.aggregate<WalletTotalRow>([
    {
      $match: {
        paidAt: { $exists: true, $ne: null },
      },
    },
    {
      $addFields: {
        orderCurrency: { $ifNull: ["$currency", "NGN"] },
      },
    },
    { $unwind: "$lines" },
    {
      $lookup: {
        from: "services",
        localField: "lines.serviceId",
        foreignField: "_id",
        as: "svc",
      },
    },
    {
      $addFields: {
        sellerUserId: {
          $ifNull: ["$lines.sellerUserId", { $arrayElemAt: ["$svc.userId", 0] }],
        },
        lineTotal: {
          $ifNull: ["$lines.lineTotal", "$lines.lineTotalNgn"],
        },
      },
    },
    {
      $match: {
        sellerUserId: { $ne: null },
        lineTotal: { $type: "number", $gt: 0 },
      },
    },
    {
      $group: {
        _id: {
          sellerUserId: "$sellerUserId",
          currency: "$orderCurrency",
        },
        total: { $sum: "$lineTotal" },
      },
    },
  ]);

  const totalsBySeller = new Map<
    string,
    Partial<Record<SupportedCurrency, number>>
  >();

  for (const row of rows) {
    const sellerId = row._id.sellerUserId?.toString?.() ?? "";
    if (!sellerId || !mongoose.Types.ObjectId.isValid(sellerId)) {
      continue;
    }
    const currency = parseSupportedCurrency(row._id.currency, "NGN");
    if (!SUPPORTED_CURRENCIES.includes(currency)) {
      continue;
    }
    const total = typeof row.total === "number" ? row.total : 0;
    if (total <= 0) {
      continue;
    }
    const existing = totalsBySeller.get(sellerId) ?? {};
    existing[currency] = (existing[currency] ?? 0) + total;
    totalsBySeller.set(sellerId, existing);
  }

  let sellersUpdated = 0;
  let walletRowsSet = 0;

  for (const [sellerId, byCurrency] of totalsBySeller) {
    await ensureWallet(sellerId);
    const uid = new mongoose.Types.ObjectId(sellerId);

    for (const currency of SUPPORTED_CURRENCIES) {
      const balance = byCurrency[currency];
      if (balance === undefined) {
        continue;
      }
      await Wallet.updateOne({ userId: uid, currency }, { $set: { balance } });
      walletRowsSet += 1;
    }

    sellersUpdated += 1;
  }

  console.log("backfill-provider-wallets-from-orders:");
  console.log("  sellers updated:", sellersUpdated);
  console.log("  wallet rows set:", walletRowsSet);
  console.log("  aggregation groups:", rows.length);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
