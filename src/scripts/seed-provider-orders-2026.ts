/**
 * Seed paid orders/receipts for a single provider across Jan–May 2026.
 *
 * Usage: npm run seed:orders-2026-provider
 * Requires DB_URI (and optional DB_NAME) in .env
 */

const dns = require("dns");
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { User } from "../models/user.model";
import { Service } from "../models/service.model";
import { ServiceCategory } from "../models/serviceCategory.model";
import { Order } from "../models/order.model";
import { Receipt } from "../models/receipt.model";
import {
  generateSimulatedPaystackReference,
  generateUniqueReceiptNumber,
} from "../modules/cart/cart.service";

dotenv.config();

// Match `src/config/database.ts` (fixes SRV/DNS issues in some environments).
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const PROVIDER_EMAIL = "dolphines@gmail.com";
const YEAR = 2026;
const MONTHS = [0, 1, 2, 3, 4]; // Jan..May
const ORDERS_PER_MONTH = 5;

const SEED_REF_PREFIX = "AMB_SEED_2026_PROVIDER_";

type SeedLine = {
  serviceId: mongoose.Types.ObjectId;
  sellerUserId: mongoose.Types.ObjectId;
  title: string;
  unitPriceNgn: number;
  quantity: number;
  lineTotalNgn: number;
  categoryName: string;
  categorySlug: string;
  departmentName: string;
};

function randomInt(minInclusive: number, maxInclusive: number): number {
  const min = Math.ceil(minInclusive);
  const max = Math.floor(maxInclusive);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPaidAtUtc(year: number, monthIdx: number): Date {
  const day = randomInt(2, 26);
  const hour = randomInt(9, 20);
  const minute = randomInt(0, 59);
  const second = randomInt(0, 59);
  return new Date(Date.UTC(year, monthIdx, day, hour, minute, second, 0));
}

function pickSome<T>(arr: T[], count: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (copy.length > 0 && out.length < count) {
    const idx = randomInt(0, copy.length - 1);
    out.push(copy.splice(idx, 1)[0] as T);
  }
  return out;
}

async function ensureProviderServices(
  providerId: mongoose.Types.ObjectId,
): Promise<mongoose.Types.ObjectId[]> {
  const existing = await Service.find({ userId: providerId }).select("_id").lean();
  const ids = existing.map((s) => s._id as mongoose.Types.ObjectId);
  if (ids.length > 0) {
    return ids;
  }

  const cat = await ServiceCategory.findOne({}).select("_id name slug departments").lean();
  if (!cat) {
    throw new Error(
      "No ServiceCategory found. Create categories first before seeding orders.",
    );
  }
  const dept =
    Array.isArray(cat.departments) && cat.departments.length > 0
      ? cat.departments[0]
      : { slug: "general", name: "General" };

  const created = await Service.create({
    title: "Seed listing (sale)",
    userId: providerId,
    serviceCategoryId: cat._id,
    listingType: "sale",
    stock: 1000,
    price: 25000,
    departmentSlug: dept.slug,
    description:
      "Seed listing created by seed-provider-orders-2026 script (safe to delete).",
    photoUrls: [],
  });

  return [(created._id as mongoose.Types.ObjectId) ?? new mongoose.Types.ObjectId(created.id)];
}

async function findOrCreateBuyerUser(excludeUserId: mongoose.Types.ObjectId) {
  const buyer = await User.findOne({
    role: "client",
    _id: { $ne: excludeUserId },
  })
    .select("_id")
    .lean();

  if (buyer?._id) {
    return buyer._id as mongoose.Types.ObjectId;
  }

  const passwordHash = await bcrypt.hash("SeedPassword123!", 10);
  const created = await User.create({
    firstName: "Seed",
    lastName: "Buyer",
    email: `seed.buyer.${Date.now()}@example.com`,
    phone: `080${randomInt(10000000, 99999999)}`,
    countryCode: "NG",
    password: passwordHash,
    role: "client",
    emailVerified: true,
  });

  return created._id as mongoose.Types.ObjectId;
}

function buildLines(
  providerId: mongoose.Types.ObjectId,
  serviceIds: mongoose.Types.ObjectId[],
  serviceCategory: { name: string; slug: string } | null,
): SeedLine[] {
  const lineCount = randomInt(1, 3);
  const pickedServices = pickSome(serviceIds, Math.min(lineCount, serviceIds.length));
  const catName = serviceCategory?.name ?? "Seed category";
  const catSlug = serviceCategory?.slug ?? "seed-category";

  const lines: SeedLine[] = [];
  for (const sid of pickedServices) {
    const qty = randomInt(1, 3);
    const unit = randomInt(8000, 65000);
    const total = unit * qty;
    lines.push({
      serviceId: sid,
      sellerUserId: providerId,
      title: `Seed order item ${sid.toString().slice(-6)}`,
      unitPriceNgn: unit,
      quantity: qty,
      lineTotalNgn: total,
      categoryName: catName,
      categorySlug: catSlug,
      departmentName: "Seed department",
    });
  }
  return lines;
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

  const alreadySeeded = await Order.countDocuments({
    paystackReference: { $regex: `^${SEED_REF_PREFIX}` },
  });
  if (alreadySeeded > 0) {
    console.log(
      "seed-provider-orders-2026: found existing seeded orders:",
      alreadySeeded,
      "— exiting (idempotent).",
    );
    await mongoose.disconnect();
    return;
  }

  const provider = await User.findOne({ email: PROVIDER_EMAIL.toLowerCase() }).lean();
  if (!provider?._id) {
    throw new Error(`Provider user not found for email ${PROVIDER_EMAIL}`);
  }
  if (provider.role !== "service_provider") {
    throw new Error(
      `User ${PROVIDER_EMAIL} is not a service_provider (found role=${String(
        provider.role,
      )})`,
    );
  }

  const providerId = provider._id as mongoose.Types.ObjectId;
  const serviceIds = await ensureProviderServices(providerId);
  const buyerUserId = await findOrCreateBuyerUser(providerId);

  const cat = await ServiceCategory.findOne({}).select("name slug").lean();
  const catMeta =
    cat && typeof cat.name === "string" && typeof cat.slug === "string"
      ? { name: cat.name, slug: cat.slug }
      : null;

  let createdOrders = 0;
  let createdReceipts = 0;

  for (const monthIdx of MONTHS) {
    for (let i = 0; i < ORDERS_PER_MONTH; i += 1) {
      const paidAt = randomPaidAtUtc(YEAR, monthIdx);
      const lines = buildLines(providerId, serviceIds, catMeta);
      const subtotalNgn = lines.reduce((s, l) => s + l.lineTotalNgn, 0);
      const receiptNumber = await generateUniqueReceiptNumber();
      const paystackReference =
        SEED_REF_PREFIX + generateSimulatedPaystackReference();

      const orderDoc = await Order.create({
        userId: buyerUserId,
        receiptNumber,
        currency: "NGN",
        subtotalNgn,
        lines,
        paymentProvider: "paystack_simulated",
        paystackReference,
        paystackSimulated: true,
        paidAt,
        createdAt: paidAt,
        updatedAt: paidAt,
      });
      createdOrders += 1;

      await Receipt.create({
        orderId: orderDoc._id,
        userId: buyerUserId,
        receiptNumber,
        currency: "NGN",
        subtotalNgn,
        lines: lines.map((l) => ({
          serviceId: l.serviceId,
          sellerUserId: l.sellerUserId,
          title: l.title,
          unitPriceNgn: l.unitPriceNgn,
          quantity: l.quantity,
          lineTotalNgn: l.lineTotalNgn,
          categoryName: l.categoryName,
          departmentName: l.departmentName,
        })),
        paymentProvider: "paystack_simulated",
        paystackReference,
        issuedAt: paidAt,
        createdAt: paidAt,
        updatedAt: paidAt,
      });
      createdReceipts += 1;
    }
  }

  console.log("seed-provider-orders-2026: provider", PROVIDER_EMAIL);
  console.log("seed-provider-orders-2026: orders created", createdOrders);
  console.log("seed-provider-orders-2026: receipts created", createdReceipts);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

