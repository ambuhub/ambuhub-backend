import mongoose from "mongoose";
import { Order } from "../../models/order.model";
import { Service } from "../../models/service.model";
import { ServiceProvider } from "../../models/serviceProvider.model";
import { User } from "../../models/user.model";
import {
  type SupportedCurrency,
} from "../../shared/currency/types";
import {
  getReceiptByOrderId,
  OrdersHttpError,
  type ReceiptDetailDto,
} from "../orders/orders.service";

const ACTIVE_LISTING_FILTER = {
  $or: [{ isAvailable: true }, { isAvailable: { $exists: false } }],
};

export type AdminDashboardStats = {
  totalUsers: number;
  clientCount: number;
  providerCount: number;
  activeListings: number;
  totalListings: number;
  totalOrders: number;
  ordersThisMonth: number;
};

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [
    clientCount,
    providerCount,
    activeListings,
    totalListings,
    totalOrders,
    ordersThisMonth,
  ] = await Promise.all([
    User.countDocuments({ role: { $in: ["client", "patient"] } }),
    User.countDocuments({ role: "service_provider" }),
    Service.countDocuments(ACTIVE_LISTING_FILTER),
    Service.countDocuments({}),
    Order.countDocuments({}),
    Order.countDocuments({ paidAt: { $gte: monthStart } }),
  ]);

  return {
    totalUsers: clientCount + providerCount,
    clientCount,
    providerCount,
    activeListings,
    totalListings,
    totalOrders,
    ordersThisMonth,
  };
}

export type AdminTransactionsMonthBucket = {
  yearMonth: string;
  label: string;
  total: number;
  orderCount: number;
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
 * Platform-wide order revenue by `paidAt` month (UTC) for a calendar year,
 * filtered by order currency (no FX mixing).
 */
export async function getAdminTransactionsByMonth(
  year: number,
  currency: SupportedCurrency,
): Promise<AdminTransactionsMonthBucket[]> {
  const buckets = calendarYearMonthsUtc(year);

  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return buckets.map((ym) => ({
      yearMonth: ym,
      label: shortMonthLabelUtc(ym),
      total: 0,
      orderCount: 0,
    }));
  }

  const rangeStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const rangeEndExclusive = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));

  const agg = await Order.aggregate<{
    _id: string;
    total: number;
    orderCount: number;
  }>([
    {
      $match: {
        paidAt: { $gte: rangeStart, $lt: rangeEndExclusive },
      },
    },
    {
      $addFields: {
        resolvedCurrency: { $ifNull: ["$currency", "NGN"] },
      },
    },
    { $match: { resolvedCurrency: currency } },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m", date: "$paidAt", timezone: "UTC" },
        },
        total: { $sum: { $ifNull: ["$subtotal", "$subtotalNgn"] } },
        orderCount: { $sum: 1 },
      },
    },
  ]);

  const revenueByMonth = new Map<string, number>();
  const countByMonth = new Map<string, number>();
  for (const row of agg) {
    revenueByMonth.set(
      row._id,
      typeof row.total === "number" ? row.total : 0,
    );
    countByMonth.set(
      row._id,
      typeof row.orderCount === "number" ? row.orderCount : 0,
    );
  }

  return buckets.map((ym) => ({
    yearMonth: ym,
    label: shortMonthLabelUtc(ym),
    total: revenueByMonth.get(ym) ?? 0,
    orderCount: countByMonth.get(ym) ?? 0,
  }));
}

export type AdminUserListItem = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  countryCode: string;
  role: "client" | "service_provider" | "admin";
  emailVerified: boolean;
  isSuspended: boolean;
  createdAt: string;
  dateOfBirth: string | null;
};

export type AdminUserProviderProfile = {
  businessName: string;
  physicalAddress: string;
  website: string | null;
};

export type AdminUserTransaction = {
  id: string;
  receiptNumber: string;
  subtotal: number;
  currency: string;
  paidAt: string;
  createdAt: string;
  lineCount: number;
  direction: "purchase" | "sale";
};

export type AdminUserDetail = AdminUserListItem & {
  updatedAt: string;
  providerProfile: AdminUserProviderProfile | null;
  transactions: AdminUserTransaction[];
};

export type AdminUserAction =
  | "verify"
  | "unverify"
  | "suspend"
  | "unsuspend"
  | "promote_to_provider"
  | "demote_to_client";

export class AdminHttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AdminHttpError";
  }
}

export type AdminUsersRoleCounts = {
  all: number;
  client: number;
  service_provider: number;
  admin: number;
};

export type AdminUsersListResult = {
  users: AdminUserListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  counts: AdminUsersRoleCounts;
};

export type ListAdminUsersParams = {
  page?: number;
  limit?: number;
  q?: string;
  role?: "all" | "client" | "service_provider" | "admin";
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeAdminUserRole(
  role: string,
): AdminUserListItem["role"] {
  if (role === "service_provider" || role === "admin") {
    return role;
  }
  return "client";
}

function normalizeUserNameFields(user: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}): { firstName: string; lastName: string } {
  const firstName = typeof user.firstName === "string" ? user.firstName.trim() : "";
  const lastName = typeof user.lastName === "string" ? user.lastName.trim() : "";

  if (firstName || lastName) {
    return {
      firstName: firstName || "User",
      lastName: lastName || "-",
    };
  }

  const emailLocal = user.email?.split("@")[0]?.trim() ?? "";
  if (emailLocal) {
    const parts = emailLocal.split(/[._-]+/).filter(Boolean);
    return {
      firstName: parts[0] ?? "User",
      lastName: parts.slice(1).join(" ") || "-",
    };
  }

  return { firstName: "User", lastName: "-" };
}

function mapAdminUserListItem(user: {
  _id: mongoose.Types.ObjectId;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  countryCode?: string | null;
  role: string;
  emailVerified?: boolean;
  isSuspended?: boolean;
  dateOfBirth?: Date | null;
  createdAt: Date;
}): AdminUserListItem {
  const names = normalizeUserNameFields(user);
  return {
    id: user._id.toString(),
    firstName: names.firstName,
    lastName: names.lastName,
    email: user.email ?? "",
    phone: user.phone ?? "",
    countryCode: user.countryCode ?? "",
    role: normalizeAdminUserRole(user.role),
    emailVerified: user.emailVerified ?? false,
    isSuspended: user.isSuspended ?? false,
    createdAt:
      user.createdAt instanceof Date
        ? user.createdAt.toISOString()
        : new Date(user.createdAt).toISOString(),
    dateOfBirth:
      user.dateOfBirth != null
        ? new Date(user.dateOfBirth).toISOString().slice(0, 10)
        : null,
  };
}

function mapOrderToTransaction(
  doc: {
    _id: mongoose.Types.ObjectId;
    receiptNumber: string;
    subtotal: number;
    currency: string;
    paidAt: Date;
    createdAt: Date;
    lines: unknown[];
  },
  direction: AdminUserTransaction["direction"],
): AdminUserTransaction {
  return {
    id: doc._id.toString(),
    receiptNumber: doc.receiptNumber,
    subtotal: doc.subtotal,
    currency: doc.currency,
    paidAt: doc.paidAt.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    lineCount: Array.isArray(doc.lines) ? doc.lines.length : 0,
    direction,
  };
}

async function getAdminUsersRoleCounts(): Promise<AdminUsersRoleCounts> {
  const rows = await User.aggregate<{ _id: string; count: number }>([
    { $group: { _id: "$role", count: { $sum: 1 } } },
  ]);

  let client = 0;
  let service_provider = 0;
  let admin = 0;

  for (const row of rows) {
    if (row._id === "service_provider") {
      service_provider += row.count;
    } else if (row._id === "admin") {
      admin += row.count;
    } else {
      client += row.count;
    }
  }

  return {
    all: client + service_provider + admin,
    client,
    service_provider,
    admin,
  };
}

export async function listAdminUsers(
  params: ListAdminUsersParams = {},
): Promise<AdminUsersListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const skip = (page - 1) * limit;
  const roleFilter = params.role ?? "all";

  const filter: Record<string, unknown> = {};
  if (roleFilter === "client") {
    filter.role = { $in: ["client", "patient"] };
  } else if (roleFilter === "service_provider") {
    filter.role = "service_provider";
  } else if (roleFilter === "admin") {
    filter.role = "admin";
  }

  const q = params.q?.trim();
  if (q) {
    const regex = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ firstName: regex }, { lastName: regex }, { email: regex }];
  }

  const [users, total, counts] = await Promise.all([
    User.find(filter)
      .select(
        "firstName lastName email phone countryCode role emailVerified isSuspended dateOfBirth createdAt",
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
    getAdminUsersRoleCounts(),
  ]);

  return {
    users: users.map((user) => mapAdminUserListItem(user)),
    page,
    limit,
    total,
    totalPages: total === 0 ? 1 : Math.ceil(total / limit),
    counts,
  };
}

export async function getAdminUserDetail(
  userId: string,
): Promise<AdminUserDetail> {
  const trimmed = userId?.trim() ?? "";
  if (!mongoose.Types.ObjectId.isValid(trimmed)) {
    throw new AdminHttpError(400, "Invalid user id");
  }

  const userOid = new mongoose.Types.ObjectId(trimmed);
  const user = await User.findById(userOid)
    .select(
      "firstName lastName email phone countryCode role emailVerified isSuspended dateOfBirth createdAt updatedAt",
    )
    .lean();

  if (!user) {
    throw new AdminHttpError(404, "User not found");
  }

  const [providerRow, purchaseOrders, saleOrders] = await Promise.all([
    ServiceProvider.findOne({ userId: userOid }).lean(),
    Order.find({ userId: userOid }).sort({ paidAt: -1 }).limit(200).lean(),
    Order.find({
      lines: { $elemMatch: { sellerUserId: userOid } },
    })
      .sort({ paidAt: -1 })
      .limit(200)
      .lean(),
  ]);

  const purchaseIds = new Set<string>();
  const transactions: AdminUserTransaction[] = [];

  for (const order of purchaseOrders) {
    purchaseIds.add(order._id.toString());
    transactions.push(
      mapOrderToTransaction(
        order as Parameters<typeof mapOrderToTransaction>[0],
        "purchase",
      ),
    );
  }

  for (const order of saleOrders) {
    const id = order._id.toString();
    if (purchaseIds.has(id)) {
      continue;
    }
    transactions.push(
      mapOrderToTransaction(
        order as Parameters<typeof mapOrderToTransaction>[0],
        "sale",
      ),
    );
  }

  transactions.sort(
    (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime(),
  );

  const base = mapAdminUserListItem(user);
  let providerProfile: AdminUserProviderProfile | null = null;
  if (providerRow) {
    providerProfile = {
      businessName: providerRow.businessName,
      physicalAddress: providerRow.physicalAddress,
      website:
        typeof providerRow.website === "string" &&
        providerRow.website.trim() !== ""
          ? providerRow.website.trim()
          : null,
    };
  }

  return {
    ...base,
    updatedAt:
      user.updatedAt instanceof Date
        ? user.updatedAt.toISOString()
        : new Date(user.updatedAt).toISOString(),
    providerProfile,
    transactions,
  };
}

export async function applyAdminUserAction(
  targetUserId: string,
  actorUserId: string,
  action: AdminUserAction,
): Promise<AdminUserDetail> {
  const trimmed = targetUserId?.trim() ?? "";
  if (!mongoose.Types.ObjectId.isValid(trimmed)) {
    throw new AdminHttpError(400, "Invalid user id");
  }

  const validActions: AdminUserAction[] = [
    "verify",
    "unverify",
    "suspend",
    "unsuspend",
    "promote_to_provider",
    "demote_to_client",
  ];
  if (!validActions.includes(action)) {
    throw new AdminHttpError(400, "Invalid action");
  }

  const user = await User.findById(trimmed);
  if (!user) {
    throw new AdminHttpError(404, "User not found");
  }

  if (
    (action === "suspend" || action === "unsuspend") &&
    user._id.toString() === actorUserId
  ) {
    throw new AdminHttpError(400, "You cannot suspend or unsuspend your own account");
  }

  const role = normalizeAdminUserRole(user.role);

  switch (action) {
    case "verify":
      user.emailVerified = true;
      break;
    case "unverify":
      user.emailVerified = false;
      break;
    case "suspend":
      user.isSuspended = true;
      break;
    case "unsuspend":
      user.isSuspended = false;
      break;
    case "promote_to_provider":
      if (role === "admin") {
        throw new AdminHttpError(400, "Admin accounts cannot be promoted to provider");
      }
      if (role === "service_provider") {
        throw new AdminHttpError(400, "User is already a service provider");
      }
      user.role = "service_provider";
      {
        const names = normalizeUserNameFields(user);
        const label = `${names.firstName} ${names.lastName}`.trim();
        await ServiceProvider.findOneAndUpdate(
          { userId: user._id },
          {
            $setOnInsert: {
              businessName: label || "Provider business",
              physicalAddress: "Pending address update",
              website: null,
            },
          },
          { upsert: true },
        );
      }
      break;
    case "demote_to_client":
      if (role === "admin") {
        throw new AdminHttpError(400, "Admin accounts cannot be demoted from this panel");
      }
      if (role === "client") {
        throw new AdminHttpError(400, "User is already a client");
      }
      user.role = "client";
      break;
    default:
      throw new AdminHttpError(400, "Invalid action");
  }

  await user.save();
  return getAdminUserDetail(user._id.toString());
}

export type AdminOrderLineKind = "sale" | "hire" | "book";

export type AdminOrderKindFilter = "all" | AdminOrderLineKind;

export type AdminOrderBuyerSummary = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

export type AdminOrderListItem = {
  id: string;
  receiptNumber: string;
  subtotal: number;
  currency: string;
  paidAt: string;
  createdAt: string;
  lineCount: number;
  primaryLineKind: AdminOrderLineKind | "mixed";
  buyer: AdminOrderBuyerSummary;
  sellerSummary: string;
};

export type AdminOrderKindCounts = {
  all: number;
  sale: number;
  hire: number;
  book: number;
};

export type AdminOrdersListResult = {
  orders: AdminOrderListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  counts: AdminOrderKindCounts;
};

export type ListAdminOrdersParams = {
  page?: number;
  limit?: number;
  q?: string;
  kind?: AdminOrderKindFilter;
};

export type AdminOrderLineDetail = {
  serviceId: string;
  sellerUserId: string | null;
  sellerName: string | null;
  lineKind: AdminOrderLineKind | null;
  title: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  categoryName: string;
  categorySlug: string;
  departmentName: string;
};

export type AdminOrderDetail = {
  id: string;
  receiptNumber: string;
  currency: string;
  subtotal: number;
  paymentProvider: string;
  paystackReference: string;
  paystackSimulated: boolean;
  paidAt: string;
  createdAt: string;
  primaryLineKind: AdminOrderLineKind | "mixed";
  buyer: AdminOrderBuyerSummary & { phone: string; countryCode: string };
  lines: AdminOrderLineDetail[];
};

type AdminOrderLineShape = {
  lineKind?: string | null;
  hireStart?: Date | null;
  hireEnd?: Date | null;
  hireBillableUnits?: number | null;
  bookStart?: Date | null;
  bookEnd?: Date | null;
  bookBillableUnits?: number | null;
};

function inferLineKind(line: AdminOrderLineShape): AdminOrderLineKind {
  const raw = line.lineKind;
  if (raw === "sale" || raw === "hire" || raw === "book") {
    return raw;
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

function missingOptionalField(): Record<string, unknown> {
  return { $exists: false };
}

function orderLineKindElemMatch(kind: AdminOrderLineKind): Record<string, unknown> {
  if (kind === "book") {
    return {
      $or: [
        { lineKind: "book" },
        { bookStart: { $exists: true, $ne: null } },
        { bookEnd: { $exists: true, $ne: null } },
        { bookBillableUnits: { $type: "number" } },
      ],
    };
  }

  if (kind === "hire") {
    return {
      $or: [
        { lineKind: "hire" },
        {
          $and: [
            { lineKind: { $ne: "book" } },
            { bookStart: missingOptionalField() },
            { bookEnd: missingOptionalField() },
            {
              $or: [
                { bookBillableUnits: missingOptionalField() },
                { bookBillableUnits: null },
              ],
            },
            {
              $or: [
                { hireStart: { $exists: true, $ne: null } },
                { hireEnd: { $exists: true, $ne: null } },
                { hireBillableUnits: { $type: "number" } },
              ],
            },
          ],
        },
      ],
    };
  }

  return {
    $or: [
      { lineKind: "sale" },
      {
        $and: [
          { $or: [{ lineKind: missingOptionalField() }, { lineKind: null }] },
          { hireStart: missingOptionalField() },
          { hireEnd: missingOptionalField() },
          {
            $or: [
              { hireBillableUnits: missingOptionalField() },
              { hireBillableUnits: null },
            ],
          },
          { bookStart: missingOptionalField() },
          { bookEnd: missingOptionalField() },
          {
            $or: [
              { bookBillableUnits: missingOptionalField() },
              { bookBillableUnits: null },
            ],
          },
        ],
      },
    ],
  };
}

function derivePrimaryLineKind(
  lines: AdminOrderLineShape[],
): AdminOrderLineKind | "mixed" {
  const kinds = new Set(lines.map((line) => inferLineKind(line)));
  if (kinds.size === 0) {
    return "sale";
  }
  if (kinds.size === 1) {
    return [...kinds][0] as AdminOrderLineKind;
  }
  return "mixed";
}

function mapBuyerSummary(user: {
  _id: mongoose.Types.ObjectId;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}): AdminOrderBuyerSummary {
  const names = normalizeUserNameFields(user);
  return {
    id: user._id.toString(),
    firstName: names.firstName,
    lastName: names.lastName,
    email: user.email ?? "",
  };
}

function sellerDisplayName(user: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
} | null): string | null {
  if (!user) return null;
  const names = normalizeUserNameFields(user);
  const label = `${names.firstName} ${names.lastName}`.trim();
  return label || user.email || null;
}

async function getAdminOrderKindCounts(): Promise<AdminOrderKindCounts> {
  const [all, sale, hire, book] = await Promise.all([
    Order.countDocuments({}),
    Order.countDocuments({ lines: { $elemMatch: orderLineKindElemMatch("sale") } }),
    Order.countDocuments({ lines: { $elemMatch: orderLineKindElemMatch("hire") } }),
    Order.countDocuments({ lines: { $elemMatch: orderLineKindElemMatch("book") } }),
  ]);
  return { all, sale, hire, book };
}

async function loadSellerMap(
  orders: { lines: { sellerUserId?: mongoose.Types.ObjectId | null }[] }[],
): Promise<Map<string, { firstName?: string; lastName?: string; email?: string }>> {
  const sellerIds = new Set<string>();
  for (const order of orders) {
    for (const line of order.lines) {
      if (line.sellerUserId) {
        sellerIds.add(line.sellerUserId.toString());
      }
    }
  }
  if (sellerIds.size === 0) {
    return new Map();
  }
  const sellers = await User.find({
    _id: { $in: [...sellerIds].map((id) => new mongoose.Types.ObjectId(id)) },
  })
    .select("firstName lastName email")
    .lean();
  return new Map(sellers.map((seller) => [seller._id.toString(), seller]));
}

function sellerSummaryFromOrder(
  lines: { sellerUserId?: mongoose.Types.ObjectId | null }[],
  sellerMap: Map<string, { firstName?: string; lastName?: string; email?: string }>,
): string {
  const sellerIds = [
    ...new Set(
      lines
        .map((line) => line.sellerUserId?.toString())
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (sellerIds.length === 0) {
    return "—";
  }
  if (sellerIds.length > 1) {
    return "Multiple sellers";
  }
  return sellerDisplayName(sellerMap.get(sellerIds[0] ?? "") ?? null) ?? "—";
}

export async function listAdminOrders(
  params: ListAdminOrdersParams = {},
): Promise<AdminOrdersListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const skip = (page - 1) * limit;
  const kindFilter = params.kind ?? "all";

  const filter: Record<string, unknown> = {};
  if (kindFilter !== "all") {
    filter.lines = { $elemMatch: orderLineKindElemMatch(kindFilter) };
  }

  const q = params.q?.trim();
  if (q) {
    const regex = new RegExp(escapeRegex(q), "i");
    const matchingUsers = await User.find({
      $or: [{ email: regex }, { firstName: regex }, { lastName: regex }],
    })
      .select("_id")
      .limit(200)
      .lean();
    const userIds = matchingUsers.map((user) => user._id);
    const orClauses: object[] = [{ receiptNumber: regex }];
    if (userIds.length > 0) {
      orClauses.push({ userId: { $in: userIds } });
    }
    filter.$or = orClauses;
  }

  const [orders, total, counts] = await Promise.all([
    Order.find(filter).sort({ paidAt: -1 }).skip(skip).limit(limit).lean(),
    Order.countDocuments(filter),
    getAdminOrderKindCounts(),
  ]);

  const buyerIds = [...new Set(orders.map((order) => order.userId.toString()))];
  const [buyers, sellerMap] = await Promise.all([
    User.find({ _id: { $in: buyerIds } })
      .select("firstName lastName email")
      .lean(),
    loadSellerMap(orders),
  ]);
  const buyerMap = new Map(buyers.map((buyer) => [buyer._id.toString(), buyer]));

  return {
    orders: orders.map((order) => {
      const buyer = buyerMap.get(order.userId.toString());
      return {
        id: order._id.toString(),
        receiptNumber: order.receiptNumber,
        subtotal: order.subtotal,
        currency: order.currency,
        paidAt: order.paidAt.toISOString(),
        createdAt: order.createdAt.toISOString(),
        lineCount: Array.isArray(order.lines) ? order.lines.length : 0,
        primaryLineKind: derivePrimaryLineKind(order.lines),
        buyer: buyer
          ? mapBuyerSummary(buyer)
          : {
              id: order.userId.toString(),
              firstName: "Unknown",
              lastName: "Buyer",
              email: "",
            },
        sellerSummary: sellerSummaryFromOrder(order.lines, sellerMap),
      };
    }),
    page,
    limit,
    total,
    totalPages: total === 0 ? 1 : Math.ceil(total / limit),
    counts,
  };
}

export async function getAdminOrderDetail(orderId: string): Promise<AdminOrderDetail> {
  const trimmed = orderId?.trim() ?? "";
  if (!mongoose.Types.ObjectId.isValid(trimmed)) {
    throw new AdminHttpError(400, "Invalid order id");
  }

  const order = await Order.findById(trimmed).lean();
  if (!order) {
    throw new AdminHttpError(404, "Order not found");
  }

  const sellerMap = await loadSellerMap([order]);
  const buyer = await User.findById(order.userId)
    .select("firstName lastName email phone countryCode")
    .lean();

  const buyerSummary = buyer
    ? {
        ...mapBuyerSummary(buyer),
        phone: buyer.phone ?? "",
        countryCode: buyer.countryCode ?? "",
      }
    : {
        id: order.userId.toString(),
        firstName: "Unknown",
        lastName: "Buyer",
        email: "",
        phone: "",
        countryCode: "",
      };

  return {
    id: order._id.toString(),
    receiptNumber: order.receiptNumber,
    currency: order.currency,
    subtotal: order.subtotal,
    paymentProvider: order.paymentProvider,
    paystackReference: order.paystackReference,
    paystackSimulated: order.paystackSimulated,
    paidAt: order.paidAt.toISOString(),
    createdAt: order.createdAt.toISOString(),
    primaryLineKind: derivePrimaryLineKind(order.lines),
    buyer: buyerSummary,
    lines: order.lines.map((line) => {
      const sellerId = line.sellerUserId?.toString() ?? null;
      const seller = sellerId ? sellerMap.get(sellerId) ?? null : null;
      return {
        serviceId: line.serviceId.toString(),
        sellerUserId: sellerId,
        sellerName: sellerDisplayName(seller),
        lineKind:
          line.lineKind === "sale" ||
          line.lineKind === "hire" ||
          line.lineKind === "book"
            ? line.lineKind
            : null,
        title: line.title,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        lineTotal: line.lineTotal,
        categoryName: line.categoryName,
        categorySlug: line.categorySlug,
        departmentName: line.departmentName,
      };
    }),
  };
}

export async function getAdminOrderReceipt(
  orderId: string,
): Promise<ReceiptDetailDto> {
  try {
    return await getReceiptByOrderId(orderId);
  } catch (err) {
    if (err instanceof OrdersHttpError) {
      throw new AdminHttpError(err.statusCode, err.message);
    }
    throw err;
  }
}
