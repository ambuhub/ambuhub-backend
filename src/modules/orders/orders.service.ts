import mongoose from "mongoose";
import { Order } from "../../models/order.model";
import { Receipt } from "../../models/receipt.model";
import { Service } from "../../models/service.model";
import { User } from "../../models/user.model";
import {
  CartHttpError,
  clearCart,
  generateSimulatedPaystackReference,
  generateUniqueReceiptNumber,
  loadBookServiceForCheckout,
  loadHireServiceForCheckout,
  mapServiceToLineMeta,
  resolveCartForCheckout,
  type CartCheckoutLine,
} from "../cart/cart.service";
import {
  assertHireEndAllowed,
  parseHireReturnWindowFromDoc,
  resolveCanonicalHireEnd,
} from "../../shared/lib/hireReturnWindow";
import type { PricingPeriod } from "../services/services.service";
import { assertBookRangeAvailable } from "../../shared/lib/booking-availability";
import { computeHireBillableUnits, parseHireInstantRange } from "./hire-pricing";
import {
  creditSellersForCheckoutLines,
  rollbackSellerCredits,
  type AppliedWalletCredit,
} from "../wallet/wallet.service";
import {
  notifyProvidersOnOrderPaid,
  scheduleHireReturnReminders,
  scheduleProviderHireReturnReminders,
} from "../notifications/notifications.service";

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
  lineKind?: "sale" | "hire" | "book";
  title: string;
  unitPriceNgn: number;
  quantity: number;
  lineTotalNgn: number;
  categoryName: string;
  categorySlug: string;
  departmentName: string;
  hireStart?: string;
  hireEnd?: string;
  bookStart?: string;
  bookEnd?: string;
  pricingPeriod?: PricingPeriod;
  hireBillableUnits?: number;
  bookBillableUnits?: number;
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
    lineKind?: "sale" | "hire" | "book";
    title: string;
    unitPriceNgn: number;
    quantity: number;
    lineTotalNgn: number;
    categoryName: string;
    categorySlug: string;
    departmentName: string;
    hireStart?: Date;
    hireEnd?: Date;
    bookStart?: Date;
    bookEnd?: Date;
    pricingPeriod?: PricingPeriod;
    hireBillableUnits?: number;
    bookBillableUnits?: number;
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
      ...(l.lineKind ? { lineKind: l.lineKind } : {}),
      title: l.title,
      unitPriceNgn: l.unitPriceNgn,
      quantity: l.quantity,
      lineTotalNgn: l.lineTotalNgn,
      categoryName: l.categoryName,
      categorySlug: l.categorySlug,
      departmentName: l.departmentName,
      ...(l.hireStart ? { hireStart: l.hireStart.toISOString() } : {}),
      ...(l.hireEnd ? { hireEnd: l.hireEnd.toISOString() } : {}),
      ...(l.bookStart ? { bookStart: l.bookStart.toISOString() } : {}),
      ...(l.bookEnd ? { bookEnd: l.bookEnd.toISOString() } : {}),
      ...(l.pricingPeriod ? { pricingPeriod: l.pricingPeriod } : {}),
      ...(typeof l.hireBillableUnits === "number"
        ? { hireBillableUnits: l.hireBillableUnits }
        : {}),
      ...(typeof l.bookBillableUnits === "number"
        ? { bookBillableUnits: l.bookBillableUnits }
        : {}),
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

    await notifyProvidersOnOrderPaid({
      buyerUserId: userId,
      orderId: orderDoc._id,
      receiptNumber,
      lines: orderLines,
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

export type HireSimulateCheckoutBody = {
  serviceId: unknown;
  quantity: unknown;
  hireStart: unknown;
  hireEnd: unknown;
};

export async function simulateHirePaystackCheckout(
  userId: string,
  body: HireSimulateCheckoutBody,
): Promise<SimulateCheckoutResult> {
  const serviceId = typeof body.serviceId === "string" ? body.serviceId.trim() : "";
  const hireStartRaw = typeof body.hireStart === "string" ? body.hireStart : "";
  const hireEndRaw = typeof body.hireEnd === "string" ? body.hireEnd : "";
  const quantityRaw =
    typeof body.quantity === "number"
      ? body.quantity
      : typeof body.quantity === "string"
        ? Number(body.quantity)
        : NaN;
  const quantity = quantityRaw;

  if (!serviceId) {
    throw new OrdersHttpError(400, "serviceId is required");
  }

  let svc: Awaited<ReturnType<typeof loadHireServiceForCheckout>>;
  try {
    svc = await loadHireServiceForCheckout(serviceId, userId, quantity);
  } catch (err) {
    if (err instanceof CartHttpError) {
      throw new OrdersHttpError(err.statusCode, err.message);
    }
    throw err;
  }

  const meta = mapServiceToLineMeta(svc);
  const pricingPeriod = svc.pricingPeriod;
  const unitPrice = typeof svc.price === "number" && svc.price >= 0 ? svc.price : 0;

  let range: { start: Date; end: Date };
  try {
    range = parseHireInstantRange(pricingPeriod, hireStartRaw, hireEndRaw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid hire dates";
    throw new OrdersHttpError(400, msg);
  }

  const returnWindow = parseHireReturnWindowFromDoc(svc.hireReturnWindow);
  if (!returnWindow) {
    throw new OrdersHttpError(400, "This listing has no return schedule");
  }
  try {
    assertHireEndAllowed(range.end, returnWindow, pricingPeriod);
    range.end = resolveCanonicalHireEnd(range.end, returnWindow, pricingPeriod);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Return time is not allowed";
    throw new OrdersHttpError(400, msg);
  }

  let hireBillableUnits: number;
  try {
    hireBillableUnits = computeHireBillableUnits(pricingPeriod, range.start, range.end);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid hire window";
    throw new OrdersHttpError(400, msg);
  }

  const lineTotalNgn = Math.round(unitPrice * quantity * hireBillableUnits);

  const walletLine: CartCheckoutLine = {
    serviceId: svc._id,
    quantity,
    title: meta.title,
    unitPriceNgn: unitPrice,
    lineTotalNgn,
    categoryName: meta.category.name,
    categorySlug: meta.category.slug,
    departmentName: meta.departmentName,
  };

  const decremented: { serviceId: mongoose.Types.ObjectId; qty: number }[] = [];

  try {
    const updated = await Service.findOneAndUpdate(
      {
        _id: svc._id,
        listingType: "hire",
        stock: { $gte: quantity },
        userId: { $ne: new mongoose.Types.ObjectId(userId) },
      },
      { $inc: { stock: -quantity } },
      { new: true },
    ).lean();

    if (!updated) {
      throw new OrdersHttpError(
        409,
        `Could not reserve stock for "${meta.title}". It may have just been booked.`,
      );
    }

    decremented.push({ serviceId: svc._id, qty: quantity });
  } catch (err) {
    for (const d of decremented.reverse()) {
      await Service.updateOne({ _id: d.serviceId }, { $inc: { stock: d.qty } });
    }
    if (err instanceof OrdersHttpError) {
      throw err;
    }
    throw err;
  }

  const sellerUserId = svc.userId;

  const orderLines = [
    {
      serviceId: svc._id,
      sellerUserId,
      lineKind: "hire" as const,
      title: meta.title,
      unitPriceNgn: unitPrice,
      quantity,
      lineTotalNgn,
      categoryName: meta.category.name,
      categorySlug: meta.category.slug,
      departmentName: meta.departmentName,
      hireStart: range.start,
      hireEnd: range.end,
      pricingPeriod,
      hireBillableUnits,
    },
  ];

  const subtotalNgn = lineTotalNgn;
  const receiptNumber = await generateUniqueReceiptNumber();
  const paystackReference = generateSimulatedPaystackReference();
  const paidAt = new Date();

  let createdOrderId: mongoose.Types.ObjectId | null = null;
  let walletApplied: AppliedWalletCredit[] = [];

  const receiptLines = orderLines.map((l) => ({
    serviceId: l.serviceId,
    sellerUserId: l.sellerUserId,
    lineKind: l.lineKind,
    title: l.title,
    unitPriceNgn: l.unitPriceNgn,
    quantity: l.quantity,
    lineTotalNgn: l.lineTotalNgn,
    categoryName: l.categoryName,
    departmentName: l.departmentName,
    hireStart: l.hireStart,
    hireEnd: l.hireEnd,
    pricingPeriod: l.pricingPeriod,
    hireBillableUnits: l.hireBillableUnits,
  }));

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
      lines: receiptLines,
      paymentProvider: "paystack_simulated",
      paystackReference,
      issuedAt: paidAt,
    });

    await scheduleHireReturnReminders({
      userId,
      orderId: orderDoc._id,
      lines: orderLines,
    });

    await notifyProvidersOnOrderPaid({
      buyerUserId: userId,
      orderId: orderDoc._id,
      receiptNumber,
      lines: orderLines,
    });

    await scheduleProviderHireReturnReminders({
      sellerUserId: sellerUserId.toString(),
      orderId: orderDoc._id,
      lines: orderLines,
    });

    walletApplied = await creditSellersForCheckoutLines([walletLine]);

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

export type BookSimulateCheckoutBody = {
  serviceId: unknown;
  bookStart: unknown;
  bookEnd: unknown;
};

export async function simulateBookPaystackCheckout(
  userId: string,
  body: BookSimulateCheckoutBody,
): Promise<SimulateCheckoutResult> {
  const serviceId = typeof body.serviceId === "string" ? body.serviceId.trim() : "";
  const bookStartRaw = typeof body.bookStart === "string" ? body.bookStart : "";
  const bookEndRaw = typeof body.bookEnd === "string" ? body.bookEnd : "";

  if (!serviceId) {
    throw new OrdersHttpError(400, "serviceId is required");
  }

  let svc: Awaited<ReturnType<typeof loadBookServiceForCheckout>>;
  try {
    svc = await loadBookServiceForCheckout(serviceId, userId);
  } catch (err) {
    if (err instanceof CartHttpError) {
      throw new OrdersHttpError(err.statusCode, err.message);
    }
    throw err;
  }

  const meta = mapServiceToLineMeta(svc);
  const pricingPeriod = svc.pricingPeriod;
  const unitPrice = typeof svc.price === "number" && svc.price >= 0 ? svc.price : 0;
  const quantity = 1;

  let range: { start: Date; end: Date };
  try {
    range = parseHireInstantRange(pricingPeriod, bookStartRaw, bookEndRaw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid booking dates";
    throw new OrdersHttpError(400, msg);
  }

  try {
    await assertBookRangeAvailable(
      svc._id.toString(),
      range.start,
      range.end,
      svc.bookingWindow,
      svc.bookingGapMinutes,
      pricingPeriod,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Booking time is not available";
    const status = msg.includes("conflicts") ? 409 : 400;
    throw new OrdersHttpError(status, msg);
  }

  let bookBillableUnits: number;
  try {
    bookBillableUnits = computeHireBillableUnits(pricingPeriod, range.start, range.end);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid booking window";
    throw new OrdersHttpError(400, msg);
  }

  if (bookBillableUnits < 1) {
    throw new OrdersHttpError(400, "Booking must span at least one billable unit");
  }

  const lineTotalNgn = Math.round(unitPrice * quantity * bookBillableUnits);

  const walletLine: CartCheckoutLine = {
    serviceId: svc._id,
    quantity,
    title: meta.title,
    unitPriceNgn: unitPrice,
    lineTotalNgn,
    categoryName: meta.category.name,
    categorySlug: meta.category.slug,
    departmentName: meta.departmentName,
  };

  const sellerUserId = svc.userId;

  const orderLines = [
    {
      serviceId: svc._id,
      sellerUserId,
      lineKind: "book" as const,
      title: meta.title,
      unitPriceNgn: unitPrice,
      quantity,
      lineTotalNgn,
      categoryName: meta.category.name,
      categorySlug: meta.category.slug,
      departmentName: meta.departmentName,
      bookStart: range.start,
      bookEnd: range.end,
      pricingPeriod,
      bookBillableUnits,
    },
  ];

  const subtotalNgn = lineTotalNgn;
  const receiptNumber = await generateUniqueReceiptNumber();
  const paystackReference = generateSimulatedPaystackReference();
  const paidAt = new Date();

  let createdOrderId: mongoose.Types.ObjectId | null = null;
  let walletApplied: AppliedWalletCredit[] = [];

  const receiptLines = orderLines.map((l) => ({
    serviceId: l.serviceId,
    sellerUserId: l.sellerUserId,
    lineKind: l.lineKind,
    title: l.title,
    unitPriceNgn: l.unitPriceNgn,
    quantity: l.quantity,
    lineTotalNgn: l.lineTotalNgn,
    categoryName: l.categoryName,
    departmentName: l.departmentName,
    bookStart: l.bookStart,
    bookEnd: l.bookEnd,
    pricingPeriod: l.pricingPeriod,
    bookBillableUnits: l.bookBillableUnits,
  }));

  try {
    await assertBookRangeAvailable(
      svc._id.toString(),
      range.start,
      range.end,
      svc.bookingWindow,
      svc.bookingGapMinutes,
      pricingPeriod,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Booking time is no longer available";
    throw new OrdersHttpError(409, msg);
  }

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
      lines: receiptLines,
      paymentProvider: "paystack_simulated",
      paystackReference,
      issuedAt: paidAt,
    });

    await notifyProvidersOnOrderPaid({
      buyerUserId: userId,
      orderId: orderDoc._id,
      receiptNumber,
      lines: orderLines,
    });

    walletApplied = await creditSellersForCheckoutLines([walletLine]);

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
    if (createdOrderId) {
      await Order.deleteOne({ _id: createdOrderId });
      await Receipt.deleteOne({ orderId: createdOrderId });
    }
    if (err instanceof CartHttpError) {
      throw new OrdersHttpError(err.statusCode, err.message);
    }
    if (err instanceof OrdersHttpError) {
      throw err;
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
  lineKind?: "sale" | "hire" | "book";
  title: string;
  unitPriceNgn: number;
  quantity: number;
  lineTotalNgn: number;
  categoryName: string;
  departmentName: string;
  hireStart?: string;
  hireEnd?: string;
  bookStart?: string;
  bookEnd?: string;
  pricingPeriod?: PricingPeriod;
  hireBillableUnits?: number;
  bookBillableUnits?: number;
  /** First listing photo URL when the service still exists in the catalog. */
  primaryPhotoUrl?: string;
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

  type ReceiptLineLean = {
    serviceId: mongoose.Types.ObjectId;
    sellerUserId?: mongoose.Types.ObjectId;
    lineKind?: string;
    title: string;
    unitPriceNgn: number;
    quantity: number;
    lineTotalNgn: number;
    categoryName: string;
    departmentName: string;
    hireStart?: Date;
    hireEnd?: Date;
    bookStart?: Date;
    bookEnd?: Date;
    pricingPeriod?: string;
    hireBillableUnits?: number;
    bookBillableUnits?: number;
  };

  const lines: ReceiptLineLean[] = Array.isArray(doc.lines)
    ? (doc.lines as ReceiptLineLean[])
    : [];

  const serviceIdObjs = [
    ...new Set(
      lines
        .map((l) => l.serviceId as mongoose.Types.ObjectId | undefined)
        .filter(
          (id): id is mongoose.Types.ObjectId =>
            id != null && mongoose.Types.ObjectId.isValid(id),
        )
        .map((id) => id.toString()),
    ),
  ].map((s) => new mongoose.Types.ObjectId(s));

  const photoByServiceId = new Map<string, string>();
  if (serviceIdObjs.length > 0) {
    const svcRows = await Service.find({ _id: { $in: serviceIdObjs } })
      .select({ photoUrls: 1 })
      .lean();
    for (const s of svcRows) {
      const urls = s.photoUrls as string[] | undefined;
      const first =
        Array.isArray(urls) ? urls.find((u) => typeof u === "string" && u.trim()) : undefined;
      if (first) {
        photoByServiceId.set((s._id as mongoose.Types.ObjectId).toString(), first.trim());
      }
    }
  }

  return {
    id: (doc._id as mongoose.Types.ObjectId).toString(),
    orderId: (doc.orderId as mongoose.Types.ObjectId).toString(),
    receiptNumber: doc.receiptNumber,
    currency: doc.currency,
    subtotalNgn: doc.subtotalNgn,
    lines: lines.map((l) => {
      const sid = l.serviceId as mongoose.Types.ObjectId;
      const sellerUid = l.sellerUserId as mongoose.Types.ObjectId | undefined;
      const hireStart = l.hireStart as Date | undefined;
      const hireEnd = l.hireEnd as Date | undefined;
      const bookStart = l.bookStart as Date | undefined;
      const bookEnd = l.bookEnd as Date | undefined;
      const rawKind = l.lineKind as string | undefined;
      const lineKind =
        rawKind === "hire" || rawKind === "sale" || rawKind === "book"
          ? rawKind
          : undefined;
      const rawPeriod = l.pricingPeriod as string | undefined;
      const primaryPhotoUrl = photoByServiceId.get(sid.toString());
      return {
        serviceId: sid.toString(),
        ...(sellerUid ? { sellerUserId: sellerUid.toString() } : {}),
        ...(lineKind ? { lineKind } : {}),
        title: l.title,
        unitPriceNgn: l.unitPriceNgn,
        quantity: l.quantity,
        lineTotalNgn: l.lineTotalNgn,
        categoryName: l.categoryName,
        departmentName: l.departmentName,
        ...(hireStart ? { hireStart: hireStart.toISOString() } : {}),
        ...(hireEnd ? { hireEnd: hireEnd.toISOString() } : {}),
        ...(bookStart ? { bookStart: bookStart.toISOString() } : {}),
        ...(bookEnd ? { bookEnd: bookEnd.toISOString() } : {}),
        ...(rawPeriod === "hourly" ||
        rawPeriod === "daily" ||
        rawPeriod === "weekly" ||
        rawPeriod === "monthly" ||
        rawPeriod === "yearly"
          ? { pricingPeriod: rawPeriod as PricingPeriod }
          : {}),
        ...(typeof l.hireBillableUnits === "number"
          ? { hireBillableUnits: l.hireBillableUnits }
          : {}),
        ...(typeof l.bookBillableUnits === "number"
          ? { bookBillableUnits: l.bookBillableUnits }
          : {}),
        ...(primaryPhotoUrl ? { primaryPhotoUrl } : {}),
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

/** Buyer contact exposed to listing owners for hire fulfillment (operational). */
export type ProviderHireBookingCustomerDto = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

export type ProviderHireBookingRowDto = {
  orderId: string;
  receiptNumber: string;
  paidAt: string;
  serviceId: string;
  listingTitle: string;
  hireStart: string;
  hireEnd: string;
  pricingPeriod: PricingPeriod;
  hireBillableUnits: number;
  quantity: number;
  lineTotalNgn: number;
  customer: ProviderHireBookingCustomerDto;
};

function hireLineBelongsToProvider(
  line: {
    sellerUserId?: mongoose.Types.ObjectId;
    serviceId: mongoose.Types.ObjectId;
  },
  providerOid: mongoose.Types.ObjectId,
  listingIdSet: Set<string>,
): boolean {
  const seller = line.sellerUserId;
  if (seller && seller.equals(providerOid)) {
    return true;
  }
  if (!seller && listingIdSet.has(line.serviceId.toString())) {
    return true;
  }
  return false;
}

/**
 * Flattened hire bookings for the provider dashboard: one row per qualifying hire line.
 * Rows sorted by hireEnd descending (most recent end date first).
 */
export async function listProviderHireBookings(
  providerUserId: string,
): Promise<ProviderHireBookingRowDto[]> {
  const trimmed = providerUserId?.trim() ?? "";
  if (!mongoose.Types.ObjectId.isValid(trimmed)) {
    throw new OrdersHttpError(400, "Invalid user id");
  }

  const providerOid = new mongoose.Types.ObjectId(trimmed);
  const serviceDocs = await Service.find({ userId: providerOid }).select("_id").lean();
  const serviceIds = serviceDocs.map((d) => d._id as mongoose.Types.ObjectId);
  const listingIdSet = new Set(serviceIds.map((id) => id.toString()));

  const elemMatch: Record<string, unknown> = {
    lineKind: "hire",
    $or: [{ sellerUserId: providerOid }],
  };
  if (serviceIds.length > 0) {
    (elemMatch.$or as object[]).push({ serviceId: { $in: serviceIds } });
  }

  const orders = await Order.find({
    lines: { $elemMatch: elemMatch },
  })
    .sort({ paidAt: -1 })
    .limit(500)
    .lean();

  type OrderLineLean = {
    lineKind?: string;
    sellerUserId?: mongoose.Types.ObjectId;
    serviceId: mongoose.Types.ObjectId;
    title: string;
    hireStart?: Date;
    hireEnd?: Date;
    pricingPeriod?: string;
    hireBillableUnits?: number;
    quantity: number;
    lineTotalNgn: number;
  };

  const buyerIds = new Set<string>();
  const candidateRows: {
    orderId: mongoose.Types.ObjectId;
    receiptNumber: string;
    paidAt: Date;
    buyerId: mongoose.Types.ObjectId;
    line: OrderLineLean;
  }[] = [];

  for (const doc of orders) {
    const lines = Array.isArray(doc.lines) ? (doc.lines as OrderLineLean[]) : [];
    const buyerId = doc.userId as mongoose.Types.ObjectId;
    for (const line of lines) {
      if (line.lineKind !== "hire") {
        continue;
      }
      if (!hireLineBelongsToProvider(line, providerOid, listingIdSet)) {
        continue;
      }
      const hireEnd = line.hireEnd;
      const hireStart = line.hireStart;
      if (!hireEnd || !hireStart) {
        continue;
      }
      buyerIds.add(buyerId.toString());
      candidateRows.push({
        orderId: doc._id as mongoose.Types.ObjectId,
        receiptNumber: doc.receiptNumber as string,
        paidAt: doc.paidAt as Date,
        buyerId,
        line,
      });
    }
  }

  const buyers = await User.find({
    _id: { $in: [...buyerIds].map((id) => new mongoose.Types.ObjectId(id)) },
  })
    .select("firstName lastName email phone")
    .lean();

  const buyerById = new Map<string, ProviderHireBookingCustomerDto>();
  for (const u of buyers) {
    const id = (u._id as mongoose.Types.ObjectId).toString();
    buyerById.set(id, {
      id,
      firstName: typeof u.firstName === "string" ? u.firstName : "",
      lastName: typeof u.lastName === "string" ? u.lastName : "",
      email: typeof u.email === "string" ? u.email : "",
      phone: typeof u.phone === "string" ? u.phone : "",
    });
  }

  const defaultCustomer = (id: string): ProviderHireBookingCustomerDto => ({
    id,
    firstName: "Unknown",
    lastName: "",
    email: "",
    phone: "",
  });

  const periodOrDaily = (raw: string | undefined): PricingPeriod => {
    if (
      raw === "hourly" ||
      raw === "daily" ||
      raw === "weekly" ||
      raw === "monthly" ||
      raw === "yearly"
    ) {
      return raw;
    }
    return "daily";
  };

  const rows: ProviderHireBookingRowDto[] = candidateRows.map((r) => {
    const customer = buyerById.get(r.buyerId.toString()) ?? defaultCustomer(r.buyerId.toString());
    const bu =
      typeof r.line.hireBillableUnits === "number" && r.line.hireBillableUnits >= 1
        ? r.line.hireBillableUnits
        : 1;
    return {
      orderId: r.orderId.toString(),
      receiptNumber: r.receiptNumber,
      paidAt: r.paidAt.toISOString(),
      serviceId: r.line.serviceId.toString(),
      listingTitle: r.line.title,
      hireStart: r.line.hireStart!.toISOString(),
      hireEnd: r.line.hireEnd!.toISOString(),
      pricingPeriod: periodOrDaily(r.line.pricingPeriod),
      hireBillableUnits: bu,
      quantity: r.line.quantity,
      lineTotalNgn: r.line.lineTotalNgn,
      customer,
    };
  });

  rows.sort((a, b) => new Date(b.hireEnd).getTime() - new Date(a.hireEnd).getTime());

  return rows;
}

export type ProviderPersonnelBookingRowDto = {
  orderId: string;
  receiptNumber: string;
  paidAt: string;
  serviceId: string;
  listingTitle: string;
  bookStart: string;
  bookEnd: string;
  pricingPeriod: PricingPeriod;
  bookBillableUnits: number;
  quantity: number;
  lineTotalNgn: number;
  customer: ProviderHireBookingCustomerDto;
};

export async function listProviderPersonnelBookings(
  providerUserId: string,
): Promise<ProviderPersonnelBookingRowDto[]> {
  const trimmed = providerUserId?.trim() ?? "";
  if (!mongoose.Types.ObjectId.isValid(trimmed)) {
    throw new OrdersHttpError(400, "Invalid user id");
  }

  const providerOid = new mongoose.Types.ObjectId(trimmed);
  const serviceDocs = await Service.find({ userId: providerOid }).select("_id").lean();
  const serviceIds = serviceDocs.map((d) => d._id as mongoose.Types.ObjectId);
  const listingIdSet = new Set(serviceIds.map((id) => id.toString()));

  const elemMatch: Record<string, unknown> = {
    lineKind: "book",
    $or: [{ sellerUserId: providerOid }],
  };
  if (serviceIds.length > 0) {
    (elemMatch.$or as object[]).push({ serviceId: { $in: serviceIds } });
  }

  const orders = await Order.find({
    lines: { $elemMatch: elemMatch },
  })
    .sort({ paidAt: -1 })
    .limit(500)
    .lean();

  type OrderLineLean = {
    lineKind?: string;
    sellerUserId?: mongoose.Types.ObjectId;
    serviceId: mongoose.Types.ObjectId;
    title: string;
    bookStart?: Date;
    bookEnd?: Date;
    pricingPeriod?: string;
    bookBillableUnits?: number;
    quantity: number;
    lineTotalNgn: number;
  };

  const buyerIds = new Set<string>();
  const candidateRows: {
    orderId: mongoose.Types.ObjectId;
    receiptNumber: string;
    paidAt: Date;
    buyerId: mongoose.Types.ObjectId;
    line: OrderLineLean;
  }[] = [];

  for (const doc of orders) {
    const lines = Array.isArray(doc.lines) ? (doc.lines as OrderLineLean[]) : [];
    const buyerId = doc.userId as mongoose.Types.ObjectId;
    for (const line of lines) {
      if (line.lineKind !== "book") {
        continue;
      }
      if (!hireLineBelongsToProvider(line, providerOid, listingIdSet)) {
        continue;
      }
      const bookEnd = line.bookEnd;
      const bookStart = line.bookStart;
      if (!bookEnd || !bookStart) {
        continue;
      }
      buyerIds.add(buyerId.toString());
      candidateRows.push({
        orderId: doc._id as mongoose.Types.ObjectId,
        receiptNumber: doc.receiptNumber as string,
        paidAt: doc.paidAt as Date,
        buyerId,
        line,
      });
    }
  }

  const buyers = await User.find({
    _id: { $in: [...buyerIds].map((id) => new mongoose.Types.ObjectId(id)) },
  })
    .select("firstName lastName email phone")
    .lean();

  const buyerById = new Map<string, ProviderHireBookingCustomerDto>();
  for (const u of buyers) {
    const id = (u._id as mongoose.Types.ObjectId).toString();
    buyerById.set(id, {
      id,
      firstName: typeof u.firstName === "string" ? u.firstName : "",
      lastName: typeof u.lastName === "string" ? u.lastName : "",
      email: typeof u.email === "string" ? u.email : "",
      phone: typeof u.phone === "string" ? u.phone : "",
    });
  }

  const defaultCustomer = (id: string): ProviderHireBookingCustomerDto => ({
    id,
    firstName: "Unknown",
    lastName: "",
    email: "",
    phone: "",
  });

  const periodOrDaily = (raw: string | undefined): PricingPeriod => {
    if (
      raw === "hourly" ||
      raw === "daily" ||
      raw === "weekly" ||
      raw === "monthly" ||
      raw === "yearly"
    ) {
      return raw;
    }
    return "daily";
  };

  const rows: ProviderPersonnelBookingRowDto[] = candidateRows.map((r) => {
    const customer = buyerById.get(r.buyerId.toString()) ?? defaultCustomer(r.buyerId.toString());
    const bu =
      typeof r.line.bookBillableUnits === "number" && r.line.bookBillableUnits >= 1
        ? r.line.bookBillableUnits
        : 1;
    return {
      orderId: r.orderId.toString(),
      receiptNumber: r.receiptNumber,
      paidAt: r.paidAt.toISOString(),
      serviceId: r.line.serviceId.toString(),
      listingTitle: r.line.title,
      bookStart: r.line.bookStart!.toISOString(),
      bookEnd: r.line.bookEnd!.toISOString(),
      pricingPeriod: periodOrDaily(r.line.pricingPeriod),
      bookBillableUnits: bu,
      quantity: r.line.quantity,
      lineTotalNgn: r.line.lineTotalNgn,
      customer,
    };
  });

  rows.sort((a, b) => new Date(b.bookEnd).getTime() - new Date(a.bookEnd).getTime());

  return rows;
}
