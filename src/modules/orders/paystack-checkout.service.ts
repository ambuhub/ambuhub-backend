import mongoose from "mongoose";
import {
  generatePaystackReference,
  getPaystackCallbackUrl,
  getPaystackPublicKey,
  isPaystackEnabled,
  paystackInitializeTransaction,
  paystackVerifyTransaction,
  toPaystackSubunits,
} from "../../config/paystack";
import { Order } from "../../models/order.model";
import {
  PendingCheckout,
  type PendingCheckoutKind,
} from "../../models/pending-checkout.model";
import { Receipt } from "../../models/receipt.model";
import { Service } from "../../models/service.model";
import { User } from "../../models/user.model";
import { parseSupportedCurrency, type SupportedCurrency } from "../../shared/currency/types";
import {
  assertHireEndAllowed,
  parseHireReturnWindowFromDoc,
  resolveCanonicalHireEnd,
} from "../../shared/lib/hireReturnWindow";
import { assertBookRangeAvailable } from "../../shared/lib/booking-availability";
import {
  CartHttpError,
  clearCart,
  generateUniqueReceiptNumber,
  loadBookServiceForCheckout,
  loadHireServiceForCheckout,
  mapServiceToLineMeta,
  resolveCartForCheckout,
  type CartCheckoutLine,
} from "../cart/cart.service";
import {
  notifyProvidersOnOrderPaid,
  scheduleHireReturnReminders,
  scheduleProviderHireReturnReminders,
} from "../notifications/notifications.service";
import {
  creditSellersForCheckoutLines,
  rollbackSellerCredits,
  type AppliedWalletCredit,
} from "../wallet/wallet.service";
import type { PricingPeriod } from "../services/services.service";
import {
  resolveBookCheckoutRange,
  computeHireBillableUnits,
  parseBookCalendarRange,
  parseHireInstantRange,
} from "./hire-pricing";
import {
  getMyOrderById,
  OrdersHttpError,
  type HireSimulateCheckoutBody,
  type BookSimulateCheckoutBody,
  type OrderDetailDto,
} from "./orders.service";

const PENDING_TTL_MS = 30 * 60 * 1000;

function paystackFailureStatusCode(message: string): number {
  const lower = message.toLowerCase();
  if (lower.includes("currency not supported")) {
    return 422;
  }
  if (lower.includes("not configured")) {
    return 503;
  }
  return 502;
}

function throwPaystackOrdersError(err: unknown, fallbackMessage: string): never {
  if (err instanceof OrdersHttpError) {
    throw err;
  }
  const message =
    err instanceof Error && err.message.trim()
      ? err.message.trim()
      : fallbackMessage;
  throw new OrdersHttpError(paystackFailureStatusCode(message), message);
}

export type PaystackInitializeResponse = {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
  publicKey: string;
  amount: number;
  currency: string;
  email: string;
};

export type PaystackCheckoutResult = {
  order: OrderDetailDto;
  message: string;
};

type StockReservation = {
  serviceId: string;
  qty: number;
};

type StoredOrderLine = {
  serviceId: string;
  sellerUserId: string;
  lineKind: "sale" | "hire" | "book";
  title: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
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

type SalePendingPayload = {
  kind: "sale";
  subtotal: number;
  currency: SupportedCurrency;
  lines: CartCheckoutLine[];
  decremented: StockReservation[];
  orderLines: StoredOrderLine[];
};

type HirePendingPayload = {
  kind: "hire";
  subtotal: number;
  currency: SupportedCurrency;
  decremented: StockReservation[];
  orderLines: StoredOrderLine[];
  walletLine: CartCheckoutLine;
};

type BookPendingPayload = {
  kind: "book";
  subtotal: number;
  currency: SupportedCurrency;
  orderLines: StoredOrderLine[];
  walletLine: CartCheckoutLine;
  assertRange: {
    bookStart: string;
    bookEnd: string;
    bookingGapMinutes: number;
    pricingPeriod: PricingPeriod;
  };
};

type PendingPayload = SalePendingPayload | HirePendingPayload | BookPendingPayload;

function listingUnitPrice(price: number): number {
  return price;
}

async function resolveListingCurrency(currencyInput: unknown): Promise<SupportedCurrency> {
  return parseSupportedCurrency(currencyInput, "NGN");
}

async function loadBuyerEmail(userId: string): Promise<string> {
  const user = await User.findById(userId).select({ email: 1 }).lean();
  const email = user?.email?.trim().toLowerCase();
  if (!email) {
    throw new OrdersHttpError(400, "Your account must have an email address to pay with Paystack.");
  }
  return email;
}

function assertPaystackReady(): void {
  if (!isPaystackEnabled()) {
    throw new OrdersHttpError(
      503,
      "Paystack is not configured on the server. Set PAYSTACK_SECRET_KEY and PAYSTACK_PUBLIC_KEY.",
    );
  }
}

async function releaseStockReservations(reservations: StockReservation[]): Promise<void> {
  for (const row of [...reservations].reverse()) {
    if (!mongoose.Types.ObjectId.isValid(row.serviceId)) {
      continue;
    }
    await Service.updateOne(
      { _id: new mongoose.Types.ObjectId(row.serviceId) },
      { $inc: { stock: row.qty } },
    );
  }
}

function toOrderLineDocs(stored: StoredOrderLine[]) {
  return stored.map((l) => ({
    serviceId: new mongoose.Types.ObjectId(l.serviceId),
    sellerUserId: new mongoose.Types.ObjectId(l.sellerUserId),
    lineKind: l.lineKind,
    title: l.title,
    unitPrice: l.unitPrice,
    quantity: l.quantity,
    lineTotal: l.lineTotal,
    categoryName: l.categoryName,
    categorySlug: l.categorySlug,
    departmentName: l.departmentName,
    ...(l.hireStart ? { hireStart: new Date(l.hireStart) } : {}),
    ...(l.hireEnd ? { hireEnd: new Date(l.hireEnd) } : {}),
    ...(l.bookStart ? { bookStart: new Date(l.bookStart) } : {}),
    ...(l.bookEnd ? { bookEnd: new Date(l.bookEnd) } : {}),
    ...(l.pricingPeriod ? { pricingPeriod: l.pricingPeriod } : {}),
    ...(typeof l.hireBillableUnits === "number"
      ? { hireBillableUnits: l.hireBillableUnits }
      : {}),
    ...(typeof l.bookBillableUnits === "number"
      ? { bookBillableUnits: l.bookBillableUnits }
      : {}),
  }));
}

function toReceiptLineDocs(orderLines: ReturnType<typeof toOrderLineDocs>) {
  return orderLines.map((l) => ({
    serviceId: l.serviceId,
    sellerUserId: l.sellerUserId,
    lineKind: l.lineKind,
    title: l.title,
    unitPrice: l.unitPrice,
    quantity: l.quantity,
    lineTotal: l.lineTotal,
    categoryName: l.categoryName,
    departmentName: l.departmentName,
    ...(l.hireStart ? { hireStart: l.hireStart } : {}),
    ...(l.hireEnd ? { hireEnd: l.hireEnd } : {}),
    ...(l.bookStart ? { bookStart: l.bookStart } : {}),
    ...(l.bookEnd ? { bookEnd: l.bookEnd } : {}),
    ...(l.pricingPeriod ? { pricingPeriod: l.pricingPeriod } : {}),
    ...(typeof l.hireBillableUnits === "number"
      ? { hireBillableUnits: l.hireBillableUnits }
      : {}),
    ...(typeof l.bookBillableUnits === "number"
      ? { bookBillableUnits: l.bookBillableUnits }
      : {}),
  }));
}

async function prepareSaleCheckout(userId: string): Promise<SalePendingPayload> {
  const { lines, subtotal, currency: orderCurrency } = await resolveCartForCheckout(userId);
  const decremented: StockReservation[] = [];

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

      decremented.push({
        serviceId: line.serviceId.toString(),
        qty: line.quantity,
      });
    }
  } catch (err) {
    await releaseStockReservations(decremented);
    throw err;
  }

  const uniqueServiceIds = [
    ...new Map(lines.map((l) => [l.serviceId.toString(), l.serviceId])).values(),
  ];
  const sellerRows = await Service.find({ _id: { $in: uniqueServiceIds } })
    .select("_id userId")
    .lean();
  if (sellerRows.length !== uniqueServiceIds.length) {
    await releaseStockReservations(decremented);
    throw new OrdersHttpError(500, "Could not resolve listing owners for checkout.");
  }

  const sellerByServiceId = new Map<string, mongoose.Types.ObjectId>();
  for (const row of sellerRows) {
    const uid = row.userId as mongoose.Types.ObjectId | undefined;
    if (!uid) {
      await releaseStockReservations(decremented);
      throw new OrdersHttpError(500, "Could not resolve listing owners for checkout.");
    }
    sellerByServiceId.set((row._id as mongoose.Types.ObjectId).toString(), uid);
  }

  const orderLines: StoredOrderLine[] = lines.map((l) => {
    const sellerUserId = sellerByServiceId.get(l.serviceId.toString());
    if (!sellerUserId) {
      throw new OrdersHttpError(500, "Could not resolve listing owners for checkout.");
    }
    return {
      serviceId: l.serviceId.toString(),
      sellerUserId: sellerUserId.toString(),
      lineKind: "sale",
      title: l.title,
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      lineTotal: l.lineTotal,
      categoryName: l.categoryName,
      categorySlug: l.categorySlug,
      departmentName: l.departmentName,
    };
  });

  return {
    kind: "sale",
    subtotal,
    currency: orderCurrency,
    lines,
    decremented,
    orderLines,
  };
}

async function prepareHireCheckout(
  userId: string,
  body: HireSimulateCheckoutBody,
): Promise<HirePendingPayload> {
  const serviceId = typeof body.serviceId === "string" ? body.serviceId.trim() : "";
  const hireStartRaw = typeof body.hireStart === "string" ? body.hireStart : "";
  const hireEndRaw = typeof body.hireEnd === "string" ? body.hireEnd : "";
  const quantityRaw =
    typeof body.quantity === "number"
      ? body.quantity
      : typeof body.quantity === "string"
        ? Number(body.quantity)
        : NaN;

  if (!serviceId) {
    throw new OrdersHttpError(400, "serviceId is required");
  }

  let svc: Awaited<ReturnType<typeof loadHireServiceForCheckout>>;
  try {
    svc = await loadHireServiceForCheckout(serviceId, userId, quantityRaw);
  } catch (err) {
    if (err instanceof CartHttpError) {
      throw new OrdersHttpError(err.statusCode, err.message);
    }
    throw err;
  }

  const meta = mapServiceToLineMeta(svc);
  const pricingPeriod = svc.pricingPeriod;
  const unitPrice = listingUnitPrice(
    typeof svc.price === "number" && svc.price >= 0 ? svc.price : 0,
  );
  const quantity = quantityRaw;

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

  const listingCurrency = await resolveListingCurrency(svc.currency);
  const lineTotal = Math.round(unitPrice * quantity * hireBillableUnits);
  const walletLine: CartCheckoutLine = {
    serviceId: svc._id,
    quantity,
    title: meta.title,
    unitPrice,
    lineTotal,
    currency: listingCurrency,
    categoryName: meta.category.name,
    categorySlug: meta.category.slug,
    departmentName: meta.departmentName,
  };

  const decremented: StockReservation[] = [];
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

    decremented.push({ serviceId: svc._id.toString(), qty: quantity });
  } catch (err) {
    await releaseStockReservations(decremented);
    throw err;
  }

  const orderLines: StoredOrderLine[] = [
    {
      serviceId: svc._id.toString(),
      sellerUserId: svc.userId.toString(),
      lineKind: "hire",
      title: meta.title,
      unitPrice,
      quantity,
      lineTotal,
      categoryName: meta.category.name,
      categorySlug: meta.category.slug,
      departmentName: meta.departmentName,
      hireStart: range.start.toISOString(),
      hireEnd: range.end.toISOString(),
      pricingPeriod,
      hireBillableUnits,
    },
  ];

  return {
    kind: "hire",
    subtotal: lineTotal,
    currency: listingCurrency,
    decremented,
    orderLines,
    walletLine,
  };
}

async function prepareBookCheckout(
  userId: string,
  body: BookSimulateCheckoutBody,
): Promise<BookPendingPayload> {
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
  const unitPrice = listingUnitPrice(
    typeof svc.price === "number" && svc.price >= 0 ? svc.price : 0,
  );
  const quantity = 1;

  let range: { start: Date; end: Date };
  try {
    if (!svc.bookingWindow) {
      throw new OrdersHttpError(400, "This listing has no booking schedule");
    }
    range = parseBookCalendarRange(bookStartRaw, bookEndRaw, svc.bookingWindow);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid booking dates";
    throw new OrdersHttpError(400, msg);
  }

  try {
    await assertBookRangeAvailable(
      svc._id.toString(),
      range.start,
      range.end,
      svc.bookingGapMinutes,
      pricingPeriod,
      {
        bookingWindow: svc.bookingWindow,
        hourlySchedule: svc.hourlyBookingSchedule,
      },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Booking time is not available";
    const status = msg.includes("conflicts") ? 409 : 400;
    throw new OrdersHttpError(status, msg);
  }

  const checkoutRange = await resolveBookCheckoutRange(
    svc._id.toString(),
    range,
    svc.bookingWindow,
    svc.hourlyBookingSchedule,
    svc.bookingGapMinutes,
  );
  if (!checkoutRange) {
    throw new OrdersHttpError(400, "Booking must span at least one billable unit");
  }

  const { billableUnits: bookBillableUnits, effectiveStart, effectiveEnd } =
    checkoutRange;
  const listingCurrency = await resolveListingCurrency(svc.currency);
  const lineTotal = Math.round(unitPrice * quantity * bookBillableUnits);

  const walletLine: CartCheckoutLine = {
    serviceId: svc._id,
    quantity,
    title: meta.title,
    unitPrice,
    lineTotal,
    currency: listingCurrency,
    categoryName: meta.category.name,
    categorySlug: meta.category.slug,
    departmentName: meta.departmentName,
  };

  const orderLines: StoredOrderLine[] = [
    {
      serviceId: svc._id.toString(),
      sellerUserId: svc.userId.toString(),
      lineKind: "book",
      title: meta.title,
      unitPrice,
      quantity,
      lineTotal,
      categoryName: meta.category.name,
      categorySlug: meta.category.slug,
      departmentName: meta.departmentName,
      bookStart: effectiveStart.toISOString(),
      bookEnd: effectiveEnd.toISOString(),
      pricingPeriod,
      bookBillableUnits,
    },
  ];

  return {
    kind: "book",
    subtotal: lineTotal,
    currency: listingCurrency,
    orderLines,
    walletLine,
    assertRange: {
      bookStart: range.start.toISOString(),
      bookEnd: range.end.toISOString(),
      bookingGapMinutes: svc.bookingGapMinutes,
      pricingPeriod,
    },
  };
}

async function createPendingCheckout(
  userId: string,
  kind: PendingCheckoutKind,
  payload: PendingPayload,
  callbackPath: string,
): Promise<PaystackInitializeResponse> {
  assertPaystackReady();
  const email = await loadBuyerEmail(userId);
  const reference = generatePaystackReference();
  const amountSubunits = toPaystackSubunits(payload.subtotal);

  if (amountSubunits < 100) {
    throw new OrdersHttpError(400, "Order total is below the Paystack minimum amount.");
  }

  let init;
  try {
    init = await paystackInitializeTransaction({
      email,
      amountSubunits,
      currency: payload.currency,
      reference,
      callbackUrl: getPaystackCallbackUrl(callbackPath),
      metadata: {
        userId,
        kind: payload.kind,
        checkoutReference: reference,
      },
    });
  } catch (err) {
    throwPaystackOrdersError(err, "Paystack could not initialize payment");
  }

  await PendingCheckout.create({
    userId: new mongoose.Types.ObjectId(userId),
    kind,
    reference: init.reference,
    amountSubunits,
    currency: payload.currency,
    status: "pending",
    payload,
    expiresAt: new Date(Date.now() + PENDING_TTL_MS),
  });

  return {
    authorizationUrl: init.authorizationUrl,
    accessCode: init.accessCode,
    reference: init.reference,
    publicKey: getPaystackPublicKey(),
    amount: amountSubunits,
    currency: payload.currency,
    email,
  };
}

async function fulfillPendingCheckout(
  userId: string,
  pending: {
    kind: PendingCheckoutKind;
    reference: string;
    amountSubunits: number;
    currency: string;
    payload: PendingPayload;
  },
  paystackReference: string,
  paidAt: Date,
): Promise<OrderDetailDto> {
  const payload = pending.payload;
  const receiptNumber = await generateUniqueReceiptNumber();
  const orderLines = toOrderLineDocs(payload.orderLines);
  const receiptLines = toReceiptLineDocs(orderLines);

  let walletApplied: AppliedWalletCredit[] = [];
  let createdOrderId: mongoose.Types.ObjectId | null = null;

  try {
    if (payload.kind === "book") {
      const svc = await Service.findById(payload.orderLines[0]?.serviceId)
        .select({ bookingWindow: 1, hourlyBookingSchedule: 1, bookingGapMinutes: 1 })
        .lean();
      if (!svc) {
        throw new OrdersHttpError(409, "Booking listing is no longer available.");
      }
      await assertBookRangeAvailable(
        payload.orderLines[0].serviceId,
        new Date(payload.assertRange.bookStart),
        new Date(payload.assertRange.bookEnd),
        payload.assertRange.bookingGapMinutes,
        payload.assertRange.pricingPeriod,
        {
          bookingWindow: svc.bookingWindow as Parameters<
            typeof assertBookRangeAvailable
          >[5]["bookingWindow"],
          hourlySchedule: svc.hourlyBookingSchedule as Parameters<
            typeof assertBookRangeAvailable
          >[5]["hourlySchedule"],
        },
      );
    }

    const orderDoc = await Order.create({
      userId: new mongoose.Types.ObjectId(userId),
      receiptNumber,
      currency: payload.currency,
      subtotal: payload.subtotal,
      lines: orderLines,
      paymentProvider: "paystack",
      paystackReference,
      paystackSimulated: false,
      paidAt,
    });
    createdOrderId = orderDoc._id;

    await Receipt.create({
      orderId: orderDoc._id,
      userId: new mongoose.Types.ObjectId(userId),
      receiptNumber,
      currency: payload.currency,
      subtotal: payload.subtotal,
      lines: receiptLines,
      paymentProvider: "paystack",
      paystackReference,
      issuedAt: paidAt,
    });

    if (payload.kind === "sale") {
      await notifyProvidersOnOrderPaid({
        buyerUserId: userId,
        orderId: orderDoc._id,
        receiptNumber,
        lines: orderLines,
      });
      walletApplied = await creditSellersForCheckoutLines(payload.lines);
      await clearCart(userId);
    } else if (payload.kind === "hire") {
      await scheduleHireReturnReminders({
        userId,
        orderId: orderDoc._id,
        lines: orderLines as Parameters<typeof scheduleHireReturnReminders>[0]["lines"],
      });
      await notifyProvidersOnOrderPaid({
        buyerUserId: userId,
        orderId: orderDoc._id,
        receiptNumber,
        lines: orderLines,
      });
      await scheduleProviderHireReturnReminders({
        sellerUserId: payload.orderLines[0].sellerUserId,
        orderId: orderDoc._id,
        lines: orderLines as Parameters<typeof scheduleProviderHireReturnReminders>[0]["lines"],
      });
      walletApplied = await creditSellersForCheckoutLines([payload.walletLine]);
    } else {
      await notifyProvidersOnOrderPaid({
        buyerUserId: userId,
        orderId: orderDoc._id,
        receiptNumber,
        lines: orderLines,
      });
      walletApplied = await creditSellersForCheckoutLines([payload.walletLine]);
    }

    await PendingCheckout.updateOne(
      { reference: pending.reference },
      { $set: { status: "completed" } },
    );

    return getMyOrderById(userId, orderDoc._id.toString());
  } catch (err) {
    if (walletApplied.length > 0) {
      await rollbackSellerCredits(walletApplied);
    }
    if (payload.kind === "sale") {
      await releaseStockReservations(payload.decremented);
    } else if (payload.kind === "hire") {
      await releaseStockReservations(payload.decremented);
    }
    if (createdOrderId) {
      await Order.deleteOne({ _id: createdOrderId });
      await Receipt.deleteOne({ orderId: createdOrderId });
    }
    throw err;
  }
}

export function getPaystackCheckoutConfig(): { enabled: boolean; publicKey: string | null } {
  return {
    enabled: isPaystackEnabled(),
    publicKey: isPaystackEnabled() ? getPaystackPublicKey() : null,
  };
}

export async function initializeSalePaystackCheckout(
  userId: string,
): Promise<PaystackInitializeResponse> {
  const payload = await prepareSaleCheckout(userId);
  try {
    return await createPendingCheckout(userId, "sale", payload, "/checkout");
  } catch (err) {
    await releaseStockReservations(payload.decremented);
    throw err;
  }
}

export async function initializeHirePaystackCheckout(
  userId: string,
  body: HireSimulateCheckoutBody,
): Promise<PaystackInitializeResponse> {
  const payload = await prepareHireCheckout(userId, body);
  try {
    const serviceId =
      typeof body.serviceId === "string" ? body.serviceId.trim() : "hire";
    return await createPendingCheckout(
      userId,
      "hire",
      payload,
      `/hire/${encodeURIComponent(serviceId)}`,
    );
  } catch (err) {
    await releaseStockReservations(payload.decremented);
    throw err;
  }
}

export async function initializeBookPaystackCheckout(
  userId: string,
  body: BookSimulateCheckoutBody,
): Promise<PaystackInitializeResponse> {
  const payload = await prepareBookCheckout(userId, body);
  const serviceId =
    typeof body.serviceId === "string" ? body.serviceId.trim() : "book";
  return createPendingCheckout(
    userId,
    "book",
    payload,
    `/book/${encodeURIComponent(serviceId)}`,
  );
}

export async function verifyPaystackCheckout(
  userId: string,
  referenceInput: unknown,
): Promise<PaystackCheckoutResult> {
  assertPaystackReady();
  const reference =
    typeof referenceInput === "string" ? referenceInput.trim() : "";
  if (!reference) {
    throw new OrdersHttpError(400, "reference is required");
  }

  const existing = await Order.findOne({ paystackReference: reference }).lean();
  if (existing) {
    if (existing.userId.toString() !== userId) {
      throw new OrdersHttpError(403, "This payment reference belongs to another account.");
    }
    const order = await getMyOrderById(userId, existing._id.toString());
    return { order, message: "Payment already completed." };
  }

  const pending = await PendingCheckout.findOne({
    reference,
    userId: new mongoose.Types.ObjectId(userId),
  }).lean();

  if (!pending) {
    throw new OrdersHttpError(404, "Checkout session not found or expired.");
  }

  if (pending.status === "cancelled" || pending.status === "expired") {
    throw new OrdersHttpError(409, "This checkout session is no longer active.");
  }

  if (pending.status === "completed") {
    const completed = await Order.findOne({ paystackReference: reference }).lean();
    if (completed) {
      const order = await getMyOrderById(userId, completed._id.toString());
      return { order, message: "Payment already completed." };
    }
  }

  if (pending.expiresAt.getTime() < Date.now()) {
    await PendingCheckout.updateOne({ _id: pending._id }, { $set: { status: "expired" } });
    const payload = pending.payload as PendingPayload;
    if (payload.kind === "sale" || payload.kind === "hire") {
      await releaseStockReservations(payload.decremented);
    }
    throw new OrdersHttpError(410, "Checkout session expired. Please start again.");
  }

  let verification;
  try {
    verification = await paystackVerifyTransaction(reference);
  } catch (err) {
    throwPaystackOrdersError(err, "Paystack could not verify payment");
  }
  if (verification.status !== "success") {
    throw new OrdersHttpError(402, "Payment was not successful. Please try again.");
  }

  if (verification.amount !== pending.amountSubunits) {
    throw new OrdersHttpError(400, "Paid amount does not match the checkout total.");
  }

  const paidAt = verification.paidAt ? new Date(verification.paidAt) : new Date();
  const order = await fulfillPendingCheckout(
    userId,
    {
      kind: pending.kind as PendingCheckoutKind,
      reference: pending.reference,
      amountSubunits: pending.amountSubunits,
      currency: pending.currency,
      payload: pending.payload as PendingPayload,
    },
    reference,
    paidAt,
  );

  return {
    order,
    message: "Payment completed successfully.",
  };
}

export async function cancelPaystackCheckout(
  userId: string,
  referenceInput: unknown,
): Promise<void> {
  const reference =
    typeof referenceInput === "string" ? referenceInput.trim() : "";
  if (!reference) {
    throw new OrdersHttpError(400, "reference is required");
  }

  const pending = await PendingCheckout.findOne({
    reference,
    userId: new mongoose.Types.ObjectId(userId),
    status: "pending",
  }).lean();

  if (!pending) {
    return;
  }

  await PendingCheckout.updateOne({ _id: pending._id }, { $set: { status: "cancelled" } });
  const payload = pending.payload as PendingPayload;
  if (payload.kind === "sale" || payload.kind === "hire") {
    await releaseStockReservations(payload.decremented);
  }
}
