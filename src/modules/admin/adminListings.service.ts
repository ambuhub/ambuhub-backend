import mongoose from "mongoose";
import { Service } from "../../models/service.model";
import { ServiceProvider } from "../../models/serviceProvider.model";
import { User } from "../../models/user.model";
import { parseSupportedCurrency } from "../../shared/currency/types";
import {
  getServiceDetailById,
  ServicesHttpError,
  type MarketplaceListingProviderDto,
} from "../services/services.service";
import { AdminHttpError } from "./admin.service";

const LIVE_LISTING_FILTER = {
  $or: [{ isAvailable: true }, { isAvailable: { $exists: false } }],
};

export type AdminListingType = "sale" | "hire" | "book";
export type AdminListingTypeFilter = "all" | AdminListingType;
export type AdminListingStatusFilter = "all" | "live" | "taken_down";

export type AdminListingStatusCounts = {
  all: number;
  live: number;
  taken_down: number;
};

export type AdminListingListItem = {
  id: string;
  title: string;
  listingType: AdminListingType | null;
  categoryName: string;
  categorySlug: string;
  departmentName: string;
  providerUserId: string;
  providerName: string;
  providerEmail: string;
  businessName: string | null;
  isLive: boolean;
  stock: number | null;
  price: number | null;
  currency: string;
  updatedAt: string;
  createdAt: string;
};

export type AdminListingDetail = AdminListingListItem & {
  description: string;
  departmentSlug: string;
  photoUrls: string[];
  countryCode: string | null;
  stateProvince: string | null;
  stateProvinceName: string | null;
  officeAddress: string | null;
  pricingPeriod: string | null;
  provider: MarketplaceListingProviderDto | null;
  hireReturnWindow: unknown;
  bookingWindow: unknown;
  hourlyBookingSchedule: unknown;
  bookingGapHours: number | null;
};

export type AdminListingsListResult = {
  listings: AdminListingListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  counts: AdminListingStatusCounts;
};

export type ListAdminListingsParams = {
  page?: number;
  limit?: number;
  q?: string;
  status?: AdminListingStatusFilter;
  listingType?: AdminListingTypeFilter;
};

type PopulatedCategory = {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  departments: { name: string; slug: string }[];
};

type PopulatedUser = {
  _id: mongoose.Types.ObjectId;
  firstName?: string;
  lastName?: string;
  email?: string;
};

type LeanListingRow = {
  _id: mongoose.Types.ObjectId;
  title: string;
  listingType?: AdminListingType | null;
  departmentSlug: string;
  isAvailable?: boolean;
  stock?: number | null;
  price?: number | null;
  currency?: string;
  userId: PopulatedUser | mongoose.Types.ObjectId;
  serviceCategoryId: PopulatedCategory | mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function providerDisplayName(user: PopulatedUser): string {
  const first = user.firstName?.trim() ?? "";
  const last = user.lastName?.trim() ?? "";
  const name = `${first} ${last}`.trim();
  if (name) return name;
  return user.email?.split("@")[0] ?? "Unknown provider";
}

function resolveDepartmentName(
  category: PopulatedCategory | null,
  departmentSlug: string,
): string {
  if (!category) return departmentSlug;
  const dept = category.departments.find((d) => d.slug === departmentSlug);
  return dept?.name ?? departmentSlug;
}

function isPopulatedUser(
  value: PopulatedUser | mongoose.Types.ObjectId,
): value is PopulatedUser {
  return typeof value === "object" && value !== null && "_id" in value;
}

function isPopulatedCategory(
  value: PopulatedCategory | mongoose.Types.ObjectId | null,
): value is PopulatedCategory {
  return (
    value !== null &&
    typeof value === "object" &&
    "_id" in value &&
    "slug" in value
  );
}

function mapListingListItem(
  doc: LeanListingRow,
  businessByUserId: Map<string, string>,
): AdminListingListItem {
  const user = isPopulatedUser(doc.userId) ? doc.userId : null;
  const category = isPopulatedCategory(doc.serviceCategoryId)
    ? doc.serviceCategoryId
    : null;
  const providerUserId = user?._id.toString() ?? doc.userId.toString();

  return {
    id: doc._id.toString(),
    title: doc.title,
    listingType: doc.listingType ?? null,
    categoryName: category?.name ?? "Unknown category",
    categorySlug: category?.slug ?? "unknown",
    departmentName: resolveDepartmentName(category, doc.departmentSlug),
    providerUserId,
    providerName: user ? providerDisplayName(user) : "Unknown provider",
    providerEmail: user?.email?.trim() ?? "",
    businessName: businessByUserId.get(providerUserId) ?? null,
    isLive: doc.isAvailable !== false,
    stock: typeof doc.stock === "number" ? doc.stock : null,
    price: typeof doc.price === "number" ? doc.price : null,
    currency: parseSupportedCurrency(doc.currency, "NGN"),
    updatedAt: doc.updatedAt.toISOString(),
    createdAt: doc.createdAt.toISOString(),
  };
}

async function getAdminListingStatusCounts(): Promise<AdminListingStatusCounts> {
  const [all, live, takenDown] = await Promise.all([
    Service.countDocuments({}),
    Service.countDocuments(LIVE_LISTING_FILTER),
    Service.countDocuments({ isAvailable: false }),
  ]);
  return { all, live, taken_down: takenDown };
}

function buildStatusFilter(
  status: AdminListingStatusFilter,
): Record<string, unknown> | null {
  if (status === "live") return LIVE_LISTING_FILTER;
  if (status === "taken_down") return { isAvailable: false };
  return null;
}

async function buildListingsFilter(
  params: ListAdminListingsParams,
): Promise<Record<string, unknown>> {
  const parts: Record<string, unknown>[] = [];
  const status = params.status ?? "all";
  const statusFilter = buildStatusFilter(status);
  if (statusFilter) {
    parts.push(statusFilter);
  }

  const listingType = params.listingType ?? "all";
  if (listingType !== "all") {
    parts.push({ listingType });
  }

  const q = params.q?.trim();
  if (q) {
    const regex = new RegExp(escapeRegex(q), "i");
    const [matchingUsers, matchingProviders] = await Promise.all([
      User.find({
        $or: [{ email: regex }, { firstName: regex }, { lastName: regex }],
      })
        .select("_id")
        .limit(200)
        .lean(),
      ServiceProvider.find({ businessName: regex })
        .select("userId")
        .limit(200)
        .lean(),
    ]);
    const userIds = [
      ...matchingUsers.map((user) => user._id),
      ...matchingProviders.map((provider) => provider.userId),
    ];
    const searchOr: Record<string, unknown>[] = [{ title: regex }];
    if (userIds.length > 0) {
      searchOr.push({ userId: { $in: userIds } });
    }
    parts.push({ $or: searchOr });
  }

  if (parts.length === 0) return {};
  if (parts.length === 1) return parts[0];
  return { $and: parts };
}

export async function listAdminListings(
  params: ListAdminListingsParams = {},
): Promise<AdminListingsListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const skip = (page - 1) * limit;
  const filter = await buildListingsFilter(params);

  const [rows, total, counts] = await Promise.all([
    Service.find(filter)
      .populate<{ serviceCategoryId: PopulatedCategory | null }>(
        "serviceCategoryId",
        "name slug departments",
      )
      .populate<{ userId: PopulatedUser }>("userId", "firstName lastName email")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Service.countDocuments(filter),
    getAdminListingStatusCounts(),
  ]);

  const userIds = rows
    .map((row) => (isPopulatedUser(row.userId) ? row.userId._id : row.userId))
    .filter(Boolean);

  const providers = userIds.length
    ? await ServiceProvider.find({ userId: { $in: userIds } })
        .select("userId businessName")
        .lean()
    : [];

  const businessByUserId = new Map<string, string>();
  for (const provider of providers) {
    businessByUserId.set(provider.userId.toString(), provider.businessName);
  }

  return {
    listings: rows.map((row) =>
      mapListingListItem(row as LeanListingRow, businessByUserId),
    ),
    page,
    limit,
    total,
    totalPages: total === 0 ? 1 : Math.ceil(total / limit),
    counts,
  };
}

function toIsoDate(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

function mapServiceDetailToAdminListing(
  detail: Awaited<ReturnType<typeof getServiceDetailById>>,
  providerEmail: string,
  providerName: string,
): AdminListingDetail {
  return {
    id: detail.id,
    title: detail.title,
    description: detail.description,
    listingType: detail.listingType,
    categoryName: detail.category.name,
    categorySlug: detail.category.slug,
    departmentName: detail.departmentName,
    departmentSlug: detail.departmentSlug,
    providerUserId: detail.ownerUserId,
    providerName,
    providerEmail,
    businessName: detail.provider?.businessName ?? null,
    isLive: detail.isAvailable,
    stock: detail.stock,
    price: detail.price,
    currency: detail.currency,
    pricingPeriod: detail.pricingPeriod,
    photoUrls: detail.photoUrls,
    countryCode: detail.countryCode,
    stateProvince: detail.stateProvince,
    stateProvinceName: detail.stateProvinceName,
    officeAddress: detail.officeAddress,
    provider: detail.provider,
    hireReturnWindow: detail.hireReturnWindow,
    bookingWindow: detail.bookingWindow,
    hourlyBookingSchedule: detail.hourlyBookingSchedule,
    bookingGapHours: detail.bookingGapHours,
    createdAt: toIsoDate(detail.createdAt),
    updatedAt: toIsoDate(detail.updatedAt),
  };
}

export async function getAdminListingDetail(
  serviceId: string,
): Promise<AdminListingDetail> {
  let detail: Awaited<ReturnType<typeof getServiceDetailById>>;
  try {
    detail = await getServiceDetailById(serviceId);
  } catch (err) {
    if (err instanceof ServicesHttpError) {
      throw new AdminHttpError(err.statusCode, err.message);
    }
    throw err;
  }

  if (!detail.ownerUserId) {
    throw new AdminHttpError(404, "Listing not found");
  }

  const user = await User.findById(detail.ownerUserId)
    .select("firstName lastName email")
    .lean();

  const providerName = user
    ? providerDisplayName(user as PopulatedUser)
    : "Unknown provider";
  const providerEmail =
    user && typeof user.email === "string" ? user.email.trim() : "";

  return mapServiceDetailToAdminListing(detail, providerEmail, providerName);
}

export async function setAdminListingAvailability(
  serviceId: string,
  isAvailable: boolean,
): Promise<AdminListingListItem> {
  const trimmed = serviceId?.trim() ?? "";
  if (!trimmed || !mongoose.Types.ObjectId.isValid(trimmed)) {
    throw new AdminHttpError(400, "Invalid listing id");
  }
  if (typeof isAvailable !== "boolean") {
    throw new AdminHttpError(400, "isAvailable must be a boolean");
  }

  const updated = await Service.findByIdAndUpdate(
    trimmed,
    { isAvailable },
    { new: true },
  )
    .populate<{ serviceCategoryId: PopulatedCategory | null }>(
      "serviceCategoryId",
      "name slug departments",
    )
    .populate<{ userId: PopulatedUser }>("userId", "firstName lastName email")
    .lean();

  if (!updated) {
    throw new AdminHttpError(404, "Listing not found");
  }

  const provider = await ServiceProvider.findOne({
    userId: isPopulatedUser(updated.userId)
      ? updated.userId._id
      : updated.userId,
  })
    .select("businessName")
    .lean();

  const businessByUserId = new Map<string, string>();
  if (provider) {
    businessByUserId.set(provider.userId.toString(), provider.businessName);
  }

  return mapListingListItem(updated as LeanListingRow, businessByUserId);
}
