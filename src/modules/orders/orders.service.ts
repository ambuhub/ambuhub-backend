import mongoose from "mongoose";
import { Order } from "../../models/order.model";
import { Receipt } from "../../models/receipt.model";
import { Service } from "../../models/service.model";
import {
  CartHttpError,
  clearCart,
  generateSimulatedPaystackReference,
  generateUniqueReceiptNumber,
  resolveCartForCheckout,
} from "../cart/cart.service";
import {
  creditSellersForCheckoutLines,
  rollbackSellerCredits,
  type AppliedWalletCredit,
} from "../wallet/wallet.service";

export class OrdersHttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "OrdersHttpError";
  }
}

export type OrderLineDto = {
  serviceId: string;
  /** Present on orders created after seller snapshot was added. */
  sellerUserId?: string;
  title: string;
  unitPriceNgn: number;
  quantity: number;
  lineTotalNgn: number;
  categoryName: string;
  categorySlug: string;
  departmentName: string;
};

export type OrderSummaryDto = {
  id: string;
  receiptNumber: string;
  subtotalNgn: number;
  currency: string;
  paidAt: string;
  createdAt: string;
  lineCount: number;
};

export type OrderDetailDto = {
  id: string;
  receiptNumber: string;
  currency: string;
  subtotalNgn: number;
  lines: OrderLineDto[];
  paymentProvider: string;
  paystackReference: string;
  paystackSimulated: boolean;
  paidAt: string;
  createdAt: string;
};

function mapOrderSummary(doc: {
  _id: mongoose.Types.ObjectId;
  receiptNumber: string;
  subtotalNgn: number;
  currency: string;
  paidAt: Date;
  createdAt: Date;
  lines: unknown[];
}): OrderSummaryDto {
  return {
    id: doc._id.toString(),
    receiptNumber: doc.receiptNumber,
    subtotalNgn: doc.subtotalNgn,
    currency: doc.currency,
    paidAt: doc.paidAt.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    lineCount: Array.isArray(doc.lines) ? doc.lines.length : 0,
  };
}

function mapOrderDetail(doc: {
  _id: mongoose.Types.ObjectId;
  receiptNumber: string;
  currency: string;
  subtotalNgn: number;
  lines: {
    serviceId: mongoose.Types.ObjectId;
    sellerUserId?: mongoose.Types.ObjectId;
    title: string;
    unitPriceNgn: number;
    quantity: number;
    lineTotalNgn: number;
    categoryName: string;
    categorySlug: string;
    departmentName: string;
  }[];
  paymentProvider: string;
  paystackReference: string;
  paystackSimulated: boolean;
  paidAt: Date;
  createdAt: Date;
}): OrderDetailDto {
  return {
    id: doc._id.toString(),
    receiptNumber: doc.receiptNumber,
    currency: doc.currency,
    subtotalNgn: doc.subtotalNgn,
    lines: doc.lines.map((l) => ({
      serviceId: l.serviceId.toString(),
      ...(l.sellerUserId
        ? { sellerUserId: l.sellerUserId.toString() }
        : {}),
      title: l.title,
      unitPriceNgn: l.unitPriceNgn,
      quantity: l.quantity,
      lineTotalNgn: l.lineTotalNgn,
      categoryName: l.categoryName,
      categorySlug: l.categorySlug,
      departmentName: l.departmentName,
    })),
    paymentProvider: doc.paymentProvider,
    paystackReference: doc.paystackReference,
    paystackSimulated: doc.paystackSimulated,
    paidAt: doc.paidAt.toISOString(),
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function listMyOrders(userId: string): Promise<OrderSummaryDto[]> {
  const rows = await Order.find({ userId: new mongoose.Types.ObjectId(userId) })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return rows.map((r) =>
    mapOrderSummary(
      r as {
        _id: mongoose.Types.ObjectId;
        receiptNumber: string;
        subtotalNgn: number;
        currency: string;
        paidAt: Date;
        createdAt: Date;
        lines: unknown[];
      },
    ),
  );
}

export async function getMyOrderById(
  userId: string,
  orderId: string,
): Promise<OrderDetailDto> {
  const trimmed = orderId?.trim() ?? "";
  if (!trimmed || !mongoose.Types.ObjectId.isValid(trimmed)) {
    throw new OrdersHttpError(400, "orderId must be a valid ObjectId");
  }

  const doc = await Order.findOne({
    _id: new mongoose.Types.ObjectId(trimmed),
    userId: new mongoose.Types.ObjectId(userId),
  }).lean();

  if (!doc) {
    throw new OrdersHttpError(404, "Order not found");
  }

  return mapOrderDetail(doc as Parameters<typeof mapOrderDetail>[0]);
}

export type SimulateCheckoutResult = {
  order: OrderDetailDto;
  message: string;
};

export async function simulatePaystackCheckout(
  userId: string,
): Promise<SimulateCheckoutResult> {
  const { lines, subtotalNgn } = await resolveCartForCheckout(userId);

  const decremented: { serviceId: mongoose.Types.ObjectId; qty: number }[] = [];

  try {
    for (const line of lines) {
      const updated = await Service.findOneAndUpdate(
        {
          _id: line.serviceId,
          listingType: "sale",
          stock: { $gte: line.quantity },
          userId: { $ne: new mongoose.Types.ObjectId(userId) },
        },
        { $inc: { stock: -line.quantity } },
        { new: true },
      ).lean();

      if (!updated) {
        throw new OrdersHttpError(
          409,
          `Could not reserve stock for "${line.title}". It may have just sold out.`,
        );
      }

      decremented.push({ serviceId: line.serviceId, qty: line.quantity });
    }
  } catch (err) {
    for (const d of decremented.reverse()) {
      await Service.updateOne({ _id: d.serviceId }, { $inc: { stock: d.qty } });
    }
    if (err instanceof OrdersHttpError) {
      throw err;
    }
    throw err;
  }

  const receiptNumber = await generateUniqueReceiptNumber();
  const paystackReference = generateSimulatedPaystackReference();
  const paidAt = new Date();

  const uniqueServiceIds = [
    ...new Map(lines.map((l) => [l.serviceId.toString(), l.serviceId])).values(),
  ];
  const sellerRows = await Service.find({ _id: { $in: uniqueServiceIds } })
    .select("_id userId")
    .lean();
  if (sellerRows.length !== uniqueServiceIds.length) {
    throw new OrdersHttpError(500, "Could not resolve listing owners for checkout.");
  }
  const sellerByServiceId = new Map<string, mongoose.Types.ObjectId>();
  for (const row of sellerRows) {
    const uid = row.userId as mongoose.Types.ObjectId | undefined;
    if (!uid) {
      throw new OrdersHttpError(500, "Could not resolve listing owners for checkout.");
    }
    sellerByServiceId.set((row._id as mongoose.Types.ObjectId).toString(), uid);
  }

  const orderLines = lines.map((l) => {
    const sellerUserId = sellerByServiceId.get(l.serviceId.toString());
    if (!sellerUserId) {
      throw new OrdersHttpError(500, "Could not resolve listing owners for checkout.");
    }
    return {
      serviceId: l.serviceId,
      sellerUserId,
      title: l.title,
      unitPriceNgn: l.unitPriceNgn,
      quantity: l.quantity,
      lineTotalNgn: l.lineTotalNgn,
      categoryName: l.categoryName,
      categorySlug: l.categorySlug,
      departmentName: l.departmentName,
    };
  });

  let createdOrderId: mongoose.Types.ObjectId | null = null;
  let walletApplied: AppliedWalletCredit[] = [];

  try {
    const orderDoc = await Order.create({
      userId: new mongoose.Types.ObjectId(userId),
      receiptNumber,
      currency: "NGN",
      subtotalNgn,
      lines: orderLines,
      paymentProvider: "paystack_simulated",
      paystackReference,
      paystackSimulated: true,
      paidAt,
    });
    createdOrderId = orderDoc._id;

    await Receipt.create({
      orderId: orderDoc._id,
      userId: new mongoose.Types.ObjectId(userId),
      receiptNumber,
      currency: "NGN",
      subtotalNgn,
      lines: orderLines.map((l) => ({
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
    });

    walletApplied = await creditSellersForCheckoutLines(lines);

    await clearCart(userId);

    const detail = mapOrderDetail(orderDoc.toObject() as Parameters<typeof mapOrderDetail>[0]);

    return {
      order: detail,
      message:
        "Payment simulated successfully. Paystack integration will replace this step later.",
    };
  } catch (err) {
    if (walletApplied.length > 0) {
      await rollbackSellerCredits(walletApplied);
    }
    for (const d of decremented.reverse()) {
      await Service.updateOne({ _id: d.serviceId }, { $inc: { stock: d.qty } });
    }
    if (createdOrderId) {
      await Order.deleteOne({ _id: createdOrderId });
      await Receipt.deleteOne({ orderId: createdOrderId });
    }
    if (err instanceof CartHttpError) {
      throw new OrdersHttpError(err.statusCode, err.message);
    }
    throw err;
  }
}

export type ReceiptSummaryDto = {
  id: string;
  orderId: string;
  receiptNumber: string;
  subtotalNgn: number;
  currency: string;
  issuedAt: string;
};

export type ReceiptLineDto = {
  serviceId: string;
  sellerUserId?: string;
  title: string;
  unitPriceNgn: number;
  quantity: number;
  lineTotalNgn: number;
  categoryName: string;
  departmentName: string;
};

export type ReceiptDetailDto = {
  id: string;
  orderId: string;
  receiptNumber: string;
  currency: string;
  subtotalNgn: number;
  lines: ReceiptLineDto[];
  paymentProvider: string;
  paystackReference: string;
  issuedAt: string;
};

export async function listMyReceipts(userId: string): Promise<ReceiptSummaryDto[]> {
  const rows = await Receipt.find({ userId: new mongoose.Types.ObjectId(userId) })
    .sort({ issuedAt: -1 })
    .limit(100)
    .lean();

  return rows.map((r) => ({
    id: (r._id as mongoose.Types.ObjectId).toString(),
    orderId: (r.orderId as mongoose.Types.ObjectId).toString(),
    receiptNumber: r.receiptNumber,
    subtotalNgn: r.subtotalNgn,
    currency: r.currency,
    issuedAt: (r.issuedAt as Date).toISOString(),
  }));
}

export async function getMyReceiptByOrderId(
  userId: string,
  orderId: string,
): Promise<ReceiptDetailDto> {
  const trimmed = orderId?.trim() ?? "";
  if (!trimmed || !mongoose.Types.ObjectId.isValid(trimmed)) {
    throw new OrdersHttpError(400, "orderId must be a valid ObjectId");
  }

  const oid = new mongoose.Types.ObjectId(trimmed);
  const doc = await Receipt.findOne({
    orderId: oid,
    userId: new mongoose.Types.ObjectId(userId),
  }).lean();

  if (!doc) {
    throw new OrdersHttpError(404, "Receipt not found");
  }

  const lines = Array.isArray(doc.lines) ? doc.lines : [];

  return {
    id: (doc._id as mongoose.Types.ObjectId).toString(),
    orderId: (doc.orderId as mongoose.Types.ObjectId).toString(),
    receiptNumber: doc.receiptNumber,
    currency: doc.currency,
    subtotalNgn: doc.subtotalNgn,
    lines: lines.map((l) => {
      const sid = l.serviceId as mongoose.Types.ObjectId;
      const sellerUid = l.sellerUserId as mongoose.Types.ObjectId | undefined;
      return {
        serviceId: sid.toString(),
        ...(sellerUid ? { sellerUserId: sellerUid.toString() } : {}),
        title: l.title,
        unitPriceNgn: l.unitPriceNgn,
        quantity: l.quantity,
        lineTotalNgn: l.lineTotalNgn,
        categoryName: l.categoryName,
        departmentName: l.departmentName,
      };
    }),
    paymentProvider: doc.paymentProvider,
    paystackReference: doc.paystackReference,
    issuedAt: (doc.issuedAt as Date).toISOString(),
  };
}

export type ProviderSalesMonthBucket = {
  yearMonth: string;
  label: string;
  totalNgn: number;
};

function calendarYearMonthsUtc(year: number): string[] {
  const out: string[] = [];
  for (let m = 1; m <= 12; m++) {
    out.push(`${year}-${String(m).padStart(2, "0")}`);
  }
  return out;
}

function shortMonthLabelUtc(yearMonth: string): string {
  const parts = yearMonth.split("-");
  const y = parseInt(parts[0] ?? "", 10);
  const m = parseInt(parts[1] ?? "", 10);
  if (!Number.isFinite(y) || !Number.isFinite(m)) {
    return yearMonth;
  }
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
}

/**
 * For a calendar year (UTC), sums each qualifying order's `subtotalNgn` by
 * `paidAt` month. An order qualifies if any line has `sellerUserId` = provider
 * or `serviceId` is one of the provider's current listings ($elemMatch, no $expr).
 */
export async function getProviderSalesByMonth(
  providerUserId: string,
  year: number,
): Promise<ProviderSalesMonthBucket[]> {
  const trimmed = providerUserId?.trim() ?? "";
  const buckets = calendarYearMonthsUtc(year);

  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return buckets.map((ym) => ({
      yearMonth: ym,
      label: shortMonthLabelUtc(ym),
      totalNgn: 0,
    }));
  }

  if (!mongoose.Types.ObjectId.isValid(trimmed)) {
    return buckets.map((ym) => ({
      yearMonth: ym,
      label: shortMonthLabelUtc(ym),
      totalNgn: 0,
    }));
  }

  const providerOid = new mongoose.Types.ObjectId(trimmed);
  const serviceIds = await Service.find({ userId: providerOid }).distinct("_id");

  const rangeStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const rangeEndExclusive = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));

  const sellerLineMatch = { lines: { $elemMatch: { sellerUserId: providerOid } } };
  const listingLineMatch =
    serviceIds.length > 0
      ? { lines: { $elemMatch: { serviceId: { $in: serviceIds } } } }
      : null;
  const sellerUserIdStringMatch = {
    $expr: {
      $gt: [
        {
          $size: {
            $filter: {
              input: "$lines",
              as: "ln",
              cond: {
                $eq: [
                  { $toString: { $ifNull: ["$$ln.sellerUserId", ""] } },
                  providerOid.toString(),
                ],
              },
            },
          },
        },
        0,
      ],
    },
  };

  const orderQualifyOr: object[] = [
    sellerLineMatch,
    sellerUserIdStringMatch,
    ...(listingLineMatch !== null ? [listingLineMatch] : []),
  ];
  const orderQualifyMatch = { $or: orderQualifyOr };

  const agg = await Order.aggregate<{
    _id: string;
    totalNgn: number;
  }>([
    {
      $match: {
        paidAt: { $gte: rangeStart, $lt: rangeEndExclusive },
      },
    },
    { $match: orderQualifyMatch },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m", date: "$paidAt", timezone: "UTC" },
        },
        totalNgn: { $sum: "$subtotalNgn" },
      },
    },
  ]);

  const totals = new Map<string, number>();
  for (const row of agg) {
    totals.set(row._id, typeof row.totalNgn === "number" ? row.totalNgn : 0);
  }

  return buckets.map((ym) => ({
    yearMonth: ym,
    label: shortMonthLabelUtc(ym),
    totalNgn: totals.get(ym) ?? 0,
  }));
}
