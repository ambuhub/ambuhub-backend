import mongoose from "mongoose";
import { Service } from "../../models/service.model";
import { ServiceProvider } from "../../models/serviceProvider.model";
import { User } from "../../models/user.model";
import { ServiceCategory } from "../../models/serviceCategory.model";
import {
  buildWeeklySegments,
  computeFreeRanges,
  loadBusyBookIntervals,
  type TimeInterval,
} from "../../shared/lib/booking-availability";
import {
  gapMinutesToHours,
  resolveBookingGapMinutesFromInput,
} from "../../shared/lib/booking-gap";
import {
  buildHourlySegments,
  enumerateLagosDates,
  getScheduledWindowsForDate,
  lagosDateString,
  hasHourlyBookingScheduleInput,
  hasValidHourlySchedule,
  normalizeHourlyBookingSchedule,
  parseHourlyBookingScheduleFromDoc,
  resolveHourlyBookingSchedule,
  type HourlyBookingSchedule,
  type HourlyDayKind,
  type TimeRange,
} from "../../shared/lib/hourly-booking-schedule";
import {
  hasBookingWindowInput,
  normalizeBookingWindow,
  parseBookingWindowFromDoc,
  type BookingWindow,
  type BookingWindowInput,
} from "../../shared/lib/bookingWindow";
import {
  hasHireReturnWindowInput,
  normalizeHireReturnWindow,
  parseHireReturnWindowFromDoc,
  type HireReturnWindow,
  type HireReturnWindowInput,
} from "../../shared/lib/hireReturnWindow";
import {
  normalizePrice,
  normalizeStock,
} from "../../shared/lib/normalize-listing-fields";
import {
  normalizeServiceLocation,
  resolveStateProvinceName,
  type ServiceLocationInput,
} from "../../shared/lib/serviceLocation";
import { parseSupportedCurrency, type SupportedCurrency } from "../../shared/currency/types";
import { currencyForCountry, type MarketplaceCountryCode } from "../../shared/currency/countryCurrency";

export type ListingType = "sale" | "hire" | "book";

export type PricingPeriod = "daily";

const PRICING_PERIODS = new Set<PricingPeriod>(["daily"]);

const PERSONNEL_CATEGORY_SLUG = "personnel";
const AMBULANCE_SERVICING_CATEGORY_SLUG = "ambulance-servicing";
export const BOOK_LISTING_TYPE_CATEGORY_SLUGS = new Set([
  PERSONNEL_CATEGORY_SLUG,
  AMBULANCE_SERVICING_CATEGORY_SLUG,
]);

const MEDICAL_TRANSPORT_CATEGORY_SLUG = "medical-transport";
const HIRE_LISTING_TYPE_CATEGORY_SLUGS = new Set([MEDICAL_TRANSPORT_CATEGORY_SLUG]);

export class ServicesHttpError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "ServicesHttpError";
  }
}

export interface MyServiceDto {
  id: string;
  title: string;
  description: string;
  listingType: ListingType | null;
  stock: number | null;
  price: number | null;
  currency: SupportedCurrency;
  pricingPeriod: PricingPeriod | null;
  isAvailable: boolean;
  departmentSlug: string;
  departmentName: string;
  category: { id: string; slug: string; name: string };
  photoUrls: string[];
  countryCode: string | null;
  stateProvince: string | null;
  stateProvinceName: string | null;
  officeAddress: string | null;
  hireReturnWindow: HireReturnWindow | null;
  bookingWindow: BookingWindow | null;
  hourlyBookingSchedule: HourlyBookingSchedule | null;
  bookingGapMinutes: number | null;
  /** Gap between bookings in hours (derived from stored minutes). */
  bookingGapHours: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Public listing card shape (same fields as MyServiceDto; no owner data). */
export type MarketplaceServiceDto = MyServiceDto;

/** Public company profile shown on marketplace listing detail pages. */
export type MarketplaceListingProviderDto = {
  businessName: string;
  website: string | null;
  physicalAddress: string;
  phone: string | null;
  countryCode: string | null;
  contactName: string | null;
};

export type MarketplaceServiceDetailDto = MyServiceDto & {
  provider: MarketplaceListingProviderDto | null;
};

type PopulatedCategory = {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  departments: { name: string; slug: string }[];
};

type LeanPopulatedService = {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  listingType?: ListingType | null;
  stock?: number | null;
  price?: number | null;
  currency?: string | null;
  pricingPeriod?: PricingPeriod | null;
  isAvailable?: boolean | null;
  departmentSlug: string;
  photoUrls: unknown;
  countryCode?: string | null;
  stateProvince?: string | null;
  officeAddress?: string | null;
  hireReturnWindow?: unknown;
  bookingWindow?: unknown;
  hourlyBookingSchedule?: unknown;
  bookingGapMinutes?: number | null;
  createdAt: Date;
  updatedAt: Date;
  serviceCategoryId: PopulatedCategory | null;
};

function mapLeanServiceToDto(doc: LeanPopulatedService): MyServiceDto {
  const cat = doc.serviceCategoryId;
  const deptSlug = doc.departmentSlug;
  let departmentName = deptSlug;
  let category: MyServiceDto["category"] = {
    id: "",
    slug: "unknown",
    name: "Unknown category",
  };

  if (cat && typeof cat === "object" && "_id" in cat) {
    category = {
      id: cat._id.toString(),
      slug: cat.slug,
      name: cat.name,
    };
    const dept = cat.departments.find((d) => d.slug === deptSlug);
    if (dept) {
      departmentName = dept.name;
    }
  }

  const listingType = doc.listingType ?? null;
  const rawPeriod = doc.pricingPeriod;
  let pricingPeriod: PricingPeriod | null =
    typeof rawPeriod === "string" && PRICING_PERIODS.has(rawPeriod as PricingPeriod)
      ? (rawPeriod as PricingPeriod)
      : null;
  if (listingType === "hire" || listingType === "book") {
    pricingPeriod = "daily";
  }

  const currency = parseSupportedCurrency(doc.currency, "NGN");

  return {
    id: doc._id.toString(),
    title: doc.title,
    description: doc.description,
    listingType: doc.listingType ?? null,
    stock: normalizeStock(doc.stock),
    price: normalizePrice(doc.price),
    currency,
    pricingPeriod,
    isAvailable: doc.isAvailable !== false,
    departmentSlug: doc.departmentSlug,
    departmentName,
    category,
    photoUrls: Array.isArray(doc.photoUrls) ? doc.photoUrls : [],
    countryCode:
      typeof doc.countryCode === "string" && doc.countryCode.trim()
        ? doc.countryCode.trim()
        : null,
    stateProvince:
      typeof doc.stateProvince === "string" && doc.stateProvince.trim()
        ? doc.stateProvince.trim()
        : null,
    stateProvinceName: resolveStateProvinceName(
      typeof doc.countryCode === "string" ? doc.countryCode : null,
      typeof doc.stateProvince === "string" ? doc.stateProvince : null,
    ),
    officeAddress:
      typeof doc.officeAddress === "string" && doc.officeAddress.trim()
        ? doc.officeAddress.trim()
        : null,
    hireReturnWindow: parseHireReturnWindowFromDoc(doc.hireReturnWindow),
    bookingWindow: parseBookingWindowFromDoc(doc.bookingWindow),
    hourlyBookingSchedule: resolveHourlyBookingSchedule(
      doc.hourlyBookingSchedule,
      doc.bookingWindow,
    ),
    bookingGapMinutes:
      typeof doc.bookingGapMinutes === "number" && Number.isInteger(doc.bookingGapMinutes)
        ? doc.bookingGapMinutes
        : null,
    bookingGapHours:
      typeof doc.bookingGapMinutes === "number" && doc.bookingGapMinutes >= 0
        ? gapMinutesToHours(doc.bookingGapMinutes)
        : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function wrapReturnWindowError(err: unknown): never {
  const msg = err instanceof Error ? err.message : "Invalid hire return window";
  throw new ServicesHttpError(400, msg);
}

function wrapBookingWindowError(err: unknown): never {
  const msg = err instanceof Error ? err.message : "Invalid booking window";
  throw new ServicesHttpError(400, msg);
}

function wrapLocationError(err: unknown): never {
  const msg = err instanceof Error ? err.message : "Invalid service location";
  throw new ServicesHttpError(400, msg);
}

const MARKETPLACE_LISTING_CAP = 200;
const MAX_FAVORITE_SERVICE_IDS = 200;

/** Legacy documents may omit isAvailable; treat as listed. */
const MARKETPLACE_AVAILABLE_FILTER = {
  $or: [{ isAvailable: true }, { isAvailable: { $exists: false } }],
} as const;

export type MarketplaceServicesResult = {
  services: MarketplaceServiceDto[];
  bannerUrl: string | null;
};

export type MarketplaceListOptions = {
  countryCode: MarketplaceCountryCode;
  sort?: "price_asc" | "price_desc" | "newest";
  priceMin?: number;
  priceMax?: number;
};

export async function listMarketplaceServices(
  categorySlug?: string,
  options?: MarketplaceListOptions,
): Promise<MarketplaceServicesResult> {
  let query: Record<string, unknown> = {};
  let bannerUrl: string | null = null;

  if (categorySlug !== undefined) {
    const trimmed = categorySlug.trim();
    if (!trimmed) {
      throw new ServicesHttpError(400, "categorySlug must be a non-empty string");
    }
    const category = await ServiceCategory.findOne(
      { slug: trimmed },
      "_id bannerUrl"
    ).lean();
    if (!category) {
      throw new ServicesHttpError(404, "Service category not found");
    }
    const rawBanner = (category as { bannerUrl?: unknown }).bannerUrl;
    bannerUrl =
      typeof rawBanner === "string" && rawBanner.trim() !== ""
        ? rawBanner.trim()
        : null;
    query = {
      $and: [{ serviceCategoryId: category._id }, MARKETPLACE_AVAILABLE_FILTER],
    };
  } else {
    query = { ...MARKETPLACE_AVAILABLE_FILTER };
  }

  if (!options?.countryCode) {
    throw new ServicesHttpError(400, "countryCode is required");
  }

  const countryFilter = { countryCode: options.countryCode };
  if (query.$and) {
    (query.$and as Record<string, unknown>[]).push(countryFilter);
  } else {
    query = { $and: [query, countryFilter] };
  }

  if (options.priceMin != null || options.priceMax != null) {
    const priceRange: Record<string, number> = {};
    if (options.priceMin != null && Number.isFinite(options.priceMin) && options.priceMin >= 0) {
      priceRange.$gte = options.priceMin;
    }
    if (options.priceMax != null && Number.isFinite(options.priceMax) && options.priceMax >= 0) {
      priceRange.$lte = options.priceMax;
    }
    if (Object.keys(priceRange).length > 0) {
      const priceClause = { price: priceRange };
      if (query.$and) {
        (query.$and as Record<string, unknown>[]).push(priceClause);
      } else {
        query = { $and: [query, priceClause] };
      }
    }
  }

  let secondarySort: Record<string, 1 | -1> = { createdAt: -1 };
  if (options.sort === "price_asc") {
    secondarySort = { price: 1, createdAt: -1 };
  } else if (options.sort === "price_desc") {
    secondarySort = { price: -1, createdAt: -1 };
  }

  const now = new Date();
  const rows = await Service.aggregate([
    { $match: query },
    {
      $lookup: {
        from: "serviceProviders",
        localField: "userId",
        foreignField: "userId",
        as: "_provider",
      },
    },
    {
      $addFields: {
        _isPremium: {
          $gt: [
            {
              $size: {
                $filter: {
                  input: "$_provider",
                  as: "p",
                  cond: {
                    $and: [
                      { $eq: ["$$p.subscriptionPlan", "premium"] },
                      { $gt: ["$$p.subscriptionExpiresAt", now] },
                    ],
                  },
                },
              },
            },
            0,
          ],
        },
      },
    },
    { $sort: { _isPremium: -1, ...secondarySort } },
    { $limit: MARKETPLACE_LISTING_CAP },
    {
      $lookup: {
        from: "serviceCategories",
        localField: "serviceCategoryId",
        foreignField: "_id",
        as: "serviceCategoryId",
      },
    },
    {
      $unwind: {
        path: "$serviceCategoryId",
        preserveNullAndEmptyArrays: true,
      },
    },
    { $project: { _provider: 0, _isPremium: 0 } },
  ]);

  return {
    services: rows.map((doc) => mapLeanServiceToDto(doc as LeanPopulatedService)),
    bannerUrl,
  };
}

function formatProviderContactName(firstName: string, lastName: string): string | null {
  const f = firstName.trim();
  const l = lastName.trim();
  if (!f && !l) {
    return null;
  }
  if (!l) {
    return f;
  }
  return `${f} ${l.charAt(0).toUpperCase()}.`;
}

async function loadMarketplaceListingProvider(
  userId: mongoose.Types.ObjectId,
): Promise<MarketplaceListingProviderDto | null> {
  const [providerRow, userRow] = await Promise.all([
    ServiceProvider.findOne({ userId }).lean(),
    User.findById(userId).select("firstName lastName phone countryCode").lean(),
  ]);

  if (!providerRow) {
    return null;
  }

  const businessName =
    typeof providerRow.businessName === "string"
      ? providerRow.businessName.trim()
      : "";
  if (!businessName) {
    return null;
  }

  const websiteRaw =
    typeof providerRow.website === "string" ? providerRow.website.trim() : "";
  const physicalAddress =
    typeof providerRow.physicalAddress === "string"
      ? providerRow.physicalAddress.trim()
      : "";

  return {
    businessName,
    website: websiteRaw || null,
    physicalAddress,
    phone:
      userRow && typeof userRow.phone === "string" && userRow.phone.trim()
        ? userRow.phone.trim()
        : null,
    countryCode:
      userRow && typeof userRow.countryCode === "string" && userRow.countryCode.trim()
        ? userRow.countryCode.trim().toLowerCase()
        : null,
    contactName: userRow
      ? formatProviderContactName(
          typeof userRow.firstName === "string" ? userRow.firstName : "",
          typeof userRow.lastName === "string" ? userRow.lastName : "",
        )
      : null,
  };
}

export type ServiceDetailWithOwnerDto = MarketplaceServiceDetailDto & {
  ownerUserId: string;
};

async function loadServiceDetailById(
  serviceId: string,
  options?: { marketplaceOnly?: boolean; countryCode?: MarketplaceCountryCode },
): Promise<ServiceDetailWithOwnerDto> {
  const trimmed = serviceId?.trim() ?? "";
  if (!trimmed || !mongoose.Types.ObjectId.isValid(trimmed)) {
    throw new ServicesHttpError(400, "serviceId must be a valid ObjectId");
  }

  const filter: Record<string, unknown> = {
    _id: new mongoose.Types.ObjectId(trimmed),
  };
  if (options?.marketplaceOnly) {
    filter.$or = [
      { isAvailable: true },
      { isAvailable: { $exists: false } },
    ];
  }

  const doc = await Service.findOne(filter)
    .populate<{ serviceCategoryId: PopulatedCategory | null }>(
      "serviceCategoryId",
      "name slug departments",
    )
    .lean();

  if (!doc) {
    throw new ServicesHttpError(404, "Service not found");
  }

  if (
    options?.countryCode &&
    typeof doc.countryCode === "string" &&
    doc.countryCode.toUpperCase() !== options.countryCode
  ) {
    throw new ServicesHttpError(404, "Service not found");
  }

  const base = mapLeanServiceToDto(doc as LeanPopulatedService);
  const ownerId = doc.userId as mongoose.Types.ObjectId | undefined;
  const provider = ownerId
    ? await loadMarketplaceListingProvider(ownerId)
    : null;

  return {
    ...base,
    provider,
    ownerUserId: ownerId?.toString() ?? "",
  };
}

/** Full listing detail including taken-down services (admin, owner tools). */
export async function getServiceDetailById(
  serviceId: string,
): Promise<ServiceDetailWithOwnerDto> {
  return loadServiceDetailById(serviceId);
}

export async function getMarketplaceServiceById(
  serviceId: string,
  countryCode?: MarketplaceCountryCode,
): Promise<MarketplaceServiceDetailDto> {
  const detail = await loadServiceDetailById(serviceId, {
    marketplaceOnly: true,
    countryCode,
  });
  const { ownerUserId: _ownerUserId, ...marketplace } = detail;
  return marketplace;
}

export async function listFavoriteServicesForUser(
  userId: string,
  countryCode?: MarketplaceCountryCode,
): Promise<MarketplaceServiceDto[]> {
  const trimmedUserId = userId?.trim() ?? "";
  if (!trimmedUserId || !mongoose.Types.ObjectId.isValid(trimmedUserId)) {
    throw new ServicesHttpError(400, "Invalid user id");
  }
  const uid = new mongoose.Types.ObjectId(trimmedUserId);

  const user = await User.findById(uid).select("favoriteServiceIds").lean();
  const rawIds =
    (user?.favoriteServiceIds as mongoose.Types.ObjectId[] | undefined) ?? [];
  if (rawIds.length === 0) {
    return [];
  }

  const rows = await Service.find({
    _id: { $in: rawIds },
    ...(countryCode ? { countryCode } : {}),
    $or: [
      { isAvailable: true },
      { isAvailable: { $exists: false } },
    ],
  })
    .populate<{ serviceCategoryId: PopulatedCategory | null }>(
      "serviceCategoryId",
      "name slug departments",
    )
    .lean();

  const byId = new Map(
    rows.map((r) => {
      const d = r as unknown as LeanPopulatedService;
      return [(r._id as mongoose.Types.ObjectId).toString(), d] as const;
    }),
  );

  const ordered: LeanPopulatedService[] = [];
  const resolvedIds: mongoose.Types.ObjectId[] = [];
  for (const id of rawIds) {
    const doc = byId.get(id.toString());
    if (doc) {
      ordered.push(doc);
      resolvedIds.push(id);
    }
  }

  if (resolvedIds.length !== rawIds.length) {
    await User.updateOne(
      { _id: uid },
      { $set: { favoriteServiceIds: resolvedIds } },
    );
  }

  return ordered.map((doc) => mapLeanServiceToDto(doc));
}

function parseFavoriteTargetServiceId(serviceId: string): mongoose.Types.ObjectId {
  const trimmed = serviceId?.trim() ?? "";
  if (!trimmed || !mongoose.Types.ObjectId.isValid(trimmed)) {
    throw new ServicesHttpError(400, "serviceId must be a valid ObjectId");
  }
  return new mongoose.Types.ObjectId(trimmed);
}

export async function addFavoriteServiceForUser(
  userId: string,
  serviceId: string,
): Promise<MarketplaceServiceDto[]> {
  const trimmedUserId = userId?.trim() ?? "";
  if (!trimmedUserId || !mongoose.Types.ObjectId.isValid(trimmedUserId)) {
    throw new ServicesHttpError(400, "Invalid user id");
  }
  const uid = new mongoose.Types.ObjectId(trimmedUserId);
  const sid = parseFavoriteTargetServiceId(serviceId);

  await getMarketplaceServiceById(serviceId);

  const user = await User.findById(uid).select("favoriteServiceIds").lean();
  const current =
    (user?.favoriteServiceIds as mongoose.Types.ObjectId[] | undefined) ?? [];
  const filtered = current.filter((x) => !x.equals(sid));
  const next = [sid, ...filtered];
  if (next.length > MAX_FAVORITE_SERVICE_IDS) {
    throw new ServicesHttpError(
      400,
      `You can save at most ${MAX_FAVORITE_SERVICE_IDS} favorites`,
    );
  }

  await User.updateOne({ _id: uid }, { $set: { favoriteServiceIds: next } });
  return listFavoriteServicesForUser(userId);
}

export async function removeFavoriteServiceForUser(
  userId: string,
  serviceId: string,
): Promise<MarketplaceServiceDto[]> {
  const trimmedUserId = userId?.trim() ?? "";
  if (!trimmedUserId || !mongoose.Types.ObjectId.isValid(trimmedUserId)) {
    throw new ServicesHttpError(400, "Invalid user id");
  }
  const uid = new mongoose.Types.ObjectId(trimmedUserId);
  const sid = parseFavoriteTargetServiceId(serviceId);

  await User.updateOne({ _id: uid }, { $pull: { favoriteServiceIds: sid } });
  return listFavoriteServicesForUser(userId);
}

export async function listMyServices(userId: string): Promise<MyServiceDto[]> {
  const rows = await Service.find({
    userId: new mongoose.Types.ObjectId(userId),
  })
    .populate<{ serviceCategoryId: PopulatedCategory | null }>(
      "serviceCategoryId",
      "name slug departments"
    )
    .sort({ createdAt: -1 })
    .lean();

  return rows.map((doc) => mapLeanServiceToDto(doc as LeanPopulatedService));
}

export async function getMyServiceById(
  userId: string,
  serviceId: string
): Promise<MyServiceDto> {
  const trimmed = serviceId?.trim() ?? "";
  if (!trimmed || !mongoose.Types.ObjectId.isValid(trimmed)) {
    throw new ServicesHttpError(400, "serviceId must be a valid ObjectId");
  }
  const doc = await Service.findOne({
    _id: new mongoose.Types.ObjectId(trimmed),
    userId: new mongoose.Types.ObjectId(userId),
  })
    .populate<{ serviceCategoryId: PopulatedCategory | null }>(
      "serviceCategoryId",
      "name slug departments"
    )
    .lean();

  if (!doc) {
    throw new ServicesHttpError(404, "Service not found");
  }
  return mapLeanServiceToDto(doc as LeanPopulatedService);
}

export async function deleteService(
  userId: string,
  serviceId: string
): Promise<void> {
  const trimmed = serviceId?.trim() ?? "";
  if (!trimmed || !mongoose.Types.ObjectId.isValid(trimmed)) {
    throw new ServicesHttpError(400, "serviceId must be a valid ObjectId");
  }
  const result = await Service.findOneAndDelete({
    _id: new mongoose.Types.ObjectId(trimmed),
    userId: new mongoose.Types.ObjectId(userId),
  });
  if (!result) {
    throw new ServicesHttpError(404, "Service not found");
  }
}

export interface CreateServiceInput extends ServiceLocationInput, HireReturnWindowInput {
  title: string;
  description: string;
  serviceCategorySlug: string;
  departmentSlug: string;
  listingType?: string | null;
  stock?: number | null;
  price?: number | null;
  pricingPeriod?: string | null;
  photoUrls?: string[];
}

function normalizeAndValidateServiceInput(
  categorySlug: string,
  input: CreateServiceInput
): {
  title: string;
  description: string;
  departmentSlug: string;
  listingType: ListingType | null;
  stock: number | null;
  price: number | null;
  pricingPeriod: PricingPeriod | null;
  photoUrls: string[];
} {
  const {
    title,
    description,
    departmentSlug,
    listingType,
    stock,
    price,
    pricingPeriod,
    photoUrls = [],
  } = input;

  if (
    !title?.trim() ||
    !description?.trim() ||
    !departmentSlug?.trim()
  ) {
    throw new ServicesHttpError(
      400,
      "title, description, and departmentSlug are required"
    );
  }

  const normalizedListingType = (() => {
    if (listingType === null || listingType === undefined) {
      return null;
    }
    if (typeof listingType !== "string") {
      throw new ServicesHttpError(
        400,
        "listingType must be 'sale', 'hire', or 'book'"
      );
    }
    const trimmed = listingType.trim();
    if (trimmed === "") {
      return null;
    }
    if (trimmed === "sale" || trimmed === "hire" || trimmed === "book") {
      return trimmed;
    }
    throw new ServicesHttpError(
      400,
      "listingType must be 'sale', 'hire', or 'book'"
    );
  })();

  const mustUseBookListingType = BOOK_LISTING_TYPE_CATEGORY_SLUGS.has(categorySlug);
  const mustUseHireListingType = HIRE_LISTING_TYPE_CATEGORY_SLUGS.has(categorySlug);

  if (mustUseBookListingType && normalizedListingType !== null && normalizedListingType !== "book") {
    throw new ServicesHttpError(
      400,
      "listingType must be 'book' for personnel and ambulance-servicing categories"
    );
  }

  if (mustUseHireListingType && normalizedListingType !== null && normalizedListingType !== "hire") {
    throw new ServicesHttpError(
      400,
      "listingType must be 'hire' for medical-transport category"
    );
  }

  if (!mustUseBookListingType && !mustUseHireListingType && normalizedListingType === null) {
    throw new ServicesHttpError(
      400,
      "listingType is required and must be 'sale' or 'hire' for this category"
    );
  }

  const effectiveListingType: ListingType | null = mustUseBookListingType
    ? "book"
    : mustUseHireListingType
      ? "hire"
      : (normalizedListingType as ListingType | null);

  const normalizedStock = (() => {
    if (stock === null || stock === undefined) {
      return null;
    }
    if (typeof stock !== "number" || !Number.isFinite(stock)) {
      throw new ServicesHttpError(400, "stock must be a number");
    }
    if (!Number.isInteger(stock) || stock < 0) {
      throw new ServicesHttpError(
        400,
        "stock must be a non-negative integer"
      );
    }
    return stock;
  })();

  if (effectiveListingType === "sale" && normalizedStock === null) {
    throw new ServicesHttpError(
      400,
      "stock is required when listingType is 'sale'"
    );
  }

  if (
    effectiveListingType !== "sale" &&
    effectiveListingType !== "hire" &&
    normalizedStock !== null
  ) {
    throw new ServicesHttpError(
      400,
      "stock must be null unless listingType is 'sale' or 'hire'"
    );
  }

  const normalizedPrice = (() => {
    if (price === null || price === undefined) {
      return null;
    }
    if (typeof price !== "number" || !Number.isFinite(price)) {
      throw new ServicesHttpError(400, "price must be a number");
    }
    if (price < 0) {
      throw new ServicesHttpError(400, "price must be a non-negative number");
    }
    return price;
  })();

  if (effectiveListingType === "sale" && normalizedPrice === null) {
    throw new ServicesHttpError(
      400,
      "price is required when listingType is 'sale'"
    );
  }

  if (effectiveListingType === "book" && normalizedPrice === null) {
    throw new ServicesHttpError(
      400,
      "price is required when listingType is 'book'"
    );
  }

  if (
    effectiveListingType !== "sale" &&
    effectiveListingType !== "hire" &&
    effectiveListingType !== "book" &&
    normalizedPrice !== null
  ) {
    throw new ServicesHttpError(
      400,
      "price must be null unless listingType is 'sale', 'hire', or 'book'"
    );
  }

  const normalizedPricingPeriod = ((): PricingPeriod | null => {
    if (pricingPeriod === null || pricingPeriod === undefined) {
      return null;
    }
    if (typeof pricingPeriod !== "string") {
      throw new ServicesHttpError(400, "pricingPeriod must be a string");
    }
    const trimmed = pricingPeriod.trim();
    if (trimmed === "") {
      return null;
    }
    if (!PRICING_PERIODS.has(trimmed as PricingPeriod)) {
      throw new ServicesHttpError(
        400,
        "pricingPeriod must be daily for hire and book listings"
      );
    }
    return trimmed as PricingPeriod;
  })();

  let resolvedPricingPeriod = normalizedPricingPeriod;
  if (effectiveListingType === "hire" || effectiveListingType === "book") {
    if (resolvedPricingPeriod === null) {
      if (effectiveListingType === "hire") {
        throw new ServicesHttpError(
          400,
          "pricingPeriod is required when listingType is 'hire'"
        );
      }
      if (effectiveListingType === "book" && normalizedPrice !== null) {
        resolvedPricingPeriod = "daily";
      }
    } else if (resolvedPricingPeriod !== "daily") {
      throw new ServicesHttpError(400, "pricingPeriod must be daily for hire and book listings");
    }
  } else if (resolvedPricingPeriod !== null) {
    throw new ServicesHttpError(
      400,
      "pricingPeriod must be null unless listingType is 'hire' or 'book'"
    );
  }

  const normalizedUrls = Array.isArray(photoUrls)
    ? photoUrls.filter((u) => typeof u === "string" && u.trim().length > 0)
    : [];

  return {
    title: title.trim(),
    description: description.trim(),
    departmentSlug: departmentSlug.trim(),
    listingType: effectiveListingType,
    stock: normalizedStock,
    price: normalizedPrice,
    pricingPeriod: resolvedPricingPeriod,
    photoUrls: normalizedUrls,
  };
}

export async function createService(
  userId: string,
  input: CreateServiceInput
) {
  if (!input.serviceCategorySlug?.trim()) {
    throw new ServicesHttpError(400, "serviceCategorySlug is required");
  }

  const category = await ServiceCategory.findOne({
    slug: input.serviceCategorySlug.trim(),
  }).lean();

  if (!category) {
    throw new ServicesHttpError(404, "Service category not found");
  }

  const deptSlugs = category.departments.map((d) => d.slug);
  const normalized = normalizeAndValidateServiceInput(category.slug, input);
  if (!deptSlugs.includes(normalized.departmentSlug)) {
    throw new ServicesHttpError(
      400,
      "departmentSlug is not valid for this category"
    );
  }

  let location: ReturnType<typeof normalizeServiceLocation>;
  try {
    location = normalizeServiceLocation(input, { requireLocation: true });
  } catch (err) {
    wrapLocationError(err);
  }
  if (!location) {
    throw new ServicesHttpError(400, "Service location is required");
  }

  const isHire = normalized.listingType === "hire";
  let hireReturnWindow: HireReturnWindow | null = null;
  try {
    hireReturnWindow = normalizeHireReturnWindow(input.hireReturnWindow, {
      required: isHire,
    });
  } catch (err) {
    wrapReturnWindowError(err);
  }
  if (isHire && !hireReturnWindow) {
    throw new ServicesHttpError(400, "hireReturnWindow is required for hire listings");
  }
  if (!isHire && hireReturnWindow) {
    throw new ServicesHttpError(
      400,
      "hireReturnWindow must be omitted unless listingType is 'hire'",
    );
  }

  const listingCurrency = currencyForCountry(location.countryCode);

  const doc = await Service.create({
    title: normalized.title,
    description: normalized.description,
    userId: new mongoose.Types.ObjectId(userId),
    serviceCategoryId: category._id,
    listingType: normalized.listingType,
    stock: normalized.stock,
    price: normalized.price,
    currency: listingCurrency,
    pricingPeriod: normalized.pricingPeriod,
    departmentSlug: normalized.departmentSlug,
    photoUrls: normalized.photoUrls,
    countryCode: location.countryCode,
    stateProvince: location.stateProvince,
    officeAddress: location.officeAddress,
    hireReturnWindow: isHire ? hireReturnWindow : null,
    isAvailable: true,
  });

  const repopulated = await Service.findById(doc._id)
    .populate<{ serviceCategoryId: PopulatedCategory | null }>(
      "serviceCategoryId",
      "name slug departments",
    )
    .lean();

  if (!repopulated) {
    throw new ServicesHttpError(404, "Service not found");
  }

  return mapLeanServiceToDto(repopulated as LeanPopulatedService);
}

export interface UpdateServiceInput extends CreateServiceInput {
  serviceId: string;
}

export async function updateService(
  userId: string,
  input: UpdateServiceInput
): Promise<MyServiceDto> {
  if (!input.serviceId?.trim()) {
    throw new ServicesHttpError(400, "serviceId is required");
  }
  if (!mongoose.Types.ObjectId.isValid(input.serviceId.trim())) {
    throw new ServicesHttpError(400, "serviceId must be a valid ObjectId");
  }
  if (!input.serviceCategorySlug?.trim()) {
    throw new ServicesHttpError(400, "serviceCategorySlug is required");
  }

  const service = await Service.findById(input.serviceId.trim()).lean();
  if (!service) {
    throw new ServicesHttpError(404, "Service not found");
  }
  if (service.userId.toString() !== userId) {
    throw new ServicesHttpError(
      403,
      "You can only update services you created"
    );
  }

  const category = await ServiceCategory.findOne({
    slug: input.serviceCategorySlug.trim(),
  }).lean();
  if (!category) {
    throw new ServicesHttpError(404, "Service category not found");
  }

  const normalized = normalizeAndValidateServiceInput(category.slug, input);
  const deptSlugs = category.departments.map((d) => d.slug);
  if (!deptSlugs.includes(normalized.departmentSlug)) {
    throw new ServicesHttpError(
      400,
      "departmentSlug is not valid for this category"
    );
  }

  let location: ReturnType<typeof normalizeServiceLocation> = null;
  try {
    location = normalizeServiceLocation(input, { requireLocation: false });
  } catch (err) {
    wrapLocationError(err);
  }

  const updatePayload: Record<string, unknown> = {
    title: normalized.title,
    description: normalized.description,
    serviceCategoryId: category._id,
    departmentSlug: normalized.departmentSlug,
    listingType: normalized.listingType,
    stock: normalized.stock,
    price: normalized.price,
    pricingPeriod: normalized.pricingPeriod,
    photoUrls: normalized.photoUrls,
  };

  if (location) {
    updatePayload.countryCode = location.countryCode;
    updatePayload.stateProvince = location.stateProvince;
    updatePayload.officeAddress = location.officeAddress;
    updatePayload.currency = currencyForCountry(location.countryCode);
  } else {
    const existingCountry =
      typeof service.countryCode === "string" ? service.countryCode : "NG";
    updatePayload.currency = currencyForCountry(existingCountry);
  }

  const isHire = normalized.listingType === "hire";
  if (hasHireReturnWindowInput(input)) {
    let hireReturnWindow: HireReturnWindow | null = null;
    try {
      hireReturnWindow = normalizeHireReturnWindow(input.hireReturnWindow, {
        required: isHire,
      });
    } catch (err) {
      wrapReturnWindowError(err);
    }
    if (isHire && !hireReturnWindow) {
      throw new ServicesHttpError(400, "hireReturnWindow is required when provided for hire");
    }
    updatePayload.hireReturnWindow = isHire ? hireReturnWindow : null;
  } else if (!isHire) {
    updatePayload.hireReturnWindow = null;
  }

  const updated = await Service.findByIdAndUpdate(
    service._id,
    updatePayload,
    { new: true },
  ).lean();

  if (!updated) {
    throw new ServicesHttpError(404, "Service not found");
  }

  const repopulated = await Service.findById(updated._id)
    .populate<{ serviceCategoryId: PopulatedCategory | null }>(
      "serviceCategoryId",
      "name slug departments"
    )
    .lean();

  if (!repopulated) {
    throw new ServicesHttpError(404, "Service not found");
  }

  return mapLeanServiceToDto(repopulated as LeanPopulatedService);
}

export async function setServiceAvailability(
  userId: string,
  serviceId: string,
  isAvailable: boolean
): Promise<MyServiceDto> {
  const trimmed = serviceId?.trim() ?? "";
  if (!trimmed || !mongoose.Types.ObjectId.isValid(trimmed)) {
    throw new ServicesHttpError(400, "serviceId must be a valid ObjectId");
  }
  if (typeof isAvailable !== "boolean") {
    throw new ServicesHttpError(400, "isAvailable must be a boolean");
  }

  const service = await Service.findById(trimmed).lean();
  if (!service) {
    throw new ServicesHttpError(404, "Service not found");
  }
  if (service.userId.toString() !== userId) {
    throw new ServicesHttpError(
      403,
      "You can only update services you created"
    );
  }

  const updated = await Service.findByIdAndUpdate(
    service._id,
    { isAvailable },
    { new: true }
  ).lean();

  if (!updated) {
    throw new ServicesHttpError(404, "Service not found");
  }

  const repopulated = await Service.findById(updated._id)
    .populate<{ serviceCategoryId: PopulatedCategory | null }>(
      "serviceCategoryId",
      "name slug departments"
    )
    .lean();

  if (!repopulated) {
    throw new ServicesHttpError(404, "Service not found");
  }

  return mapLeanServiceToDto(repopulated as LeanPopulatedService);
}

export interface UpdateBookingSettingsInput extends BookingWindowInput {
  hourlyBookingSchedule?: unknown;
  /** Preferred: gap between bookings in hours. */
  bookingGapHours?: unknown;
  /** @deprecated Use bookingGapHours. */
  bookingGapMinutes?: unknown;
  price?: number | null;
  pricingPeriod?: string | null;
  isAvailable?: boolean;
}

export async function updateBookingSettings(
  userId: string,
  serviceId: string,
  input: UpdateBookingSettingsInput,
): Promise<MyServiceDto> {
  const trimmed = serviceId?.trim() ?? "";
  if (!trimmed || !mongoose.Types.ObjectId.isValid(trimmed)) {
    throw new ServicesHttpError(400, "serviceId must be a valid ObjectId");
  }

  const service = await Service.findById(trimmed)
    .populate<{ serviceCategoryId: PopulatedCategory | null }>(
      "serviceCategoryId",
      "slug",
    )
    .lean();
  if (!service) {
    throw new ServicesHttpError(404, "Service not found");
  }
  if (service.userId.toString() !== userId) {
    throw new ServicesHttpError(403, "You can only update services you created");
  }
  if (service.listingType !== "book") {
    throw new ServicesHttpError(400, "Booking settings apply only to book listings");
  }

  const cat = service.serviceCategoryId as PopulatedCategory | null;
  const categorySlug = cat?.slug ?? "";
  if (!BOOK_LISTING_TYPE_CATEGORY_SLUGS.has(categorySlug)) {
    throw new ServicesHttpError(400, "This category does not support booking");
  }

  const updatePayload: Record<string, unknown> = {
    pricingPeriod: "daily",
  };

  if (hasHourlyBookingScheduleInput(input)) {
    try {
      const schedule = normalizeHourlyBookingSchedule(input.hourlyBookingSchedule, {
        required: true,
      });
      if (!schedule) {
        throw new ServicesHttpError(400, "Invalid booking schedule overrides");
      }
      updatePayload.hourlyBookingSchedule = schedule;
      updatePayload.bookingWindow = schedule.default;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid booking schedule overrides";
      throw new ServicesHttpError(400, msg);
    }
  } else if (hasBookingWindowInput(input)) {
    let bookingWindow: BookingWindow | null = null;
    try {
      bookingWindow = normalizeBookingWindow(input.bookingWindow, { required: true });
    } catch (err) {
      wrapBookingWindowError(err);
    }
    updatePayload.bookingWindow = bookingWindow;
    const existing = parseHourlyBookingScheduleFromDoc(service.hourlyBookingSchedule);
    updatePayload.hourlyBookingSchedule = {
      default: bookingWindow!,
      overrides: existing?.overrides ?? [],
    };
  }

  if (input.pricingPeriod !== undefined && input.pricingPeriod !== null && input.pricingPeriod !== "") {
    const trimmed = typeof input.pricingPeriod === "string" ? input.pricingPeriod.trim() : "";
    if (trimmed && trimmed !== "daily") {
      throw new ServicesHttpError(400, "pricingPeriod must be daily for book listings");
    }
  }

  const gapMinutesResolved = resolveBookingGapMinutesFromInput(input);
  if (gapMinutesResolved !== undefined) {
    try {
      updatePayload.bookingGapMinutes = gapMinutesResolved;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid booking gap";
      throw new ServicesHttpError(400, msg);
    }
  }

  if (input.price !== undefined) {
    if (input.price === null) {
      updatePayload.price = null;
    } else if (typeof input.price === "number" && Number.isFinite(input.price) && input.price >= 0) {
      updatePayload.price = input.price;
    } else {
      throw new ServicesHttpError(400, "price must be a non-negative number or null");
    }
    const countryCode =
      typeof service.countryCode === "string" ? service.countryCode : "NG";
    updatePayload.currency = currencyForCountry(countryCode);
  }

  if (input.pricingPeriod !== undefined) {
    if (
      input.pricingPeriod !== null &&
      input.pricingPeriod !== "" &&
      typeof input.pricingPeriod === "string" &&
      input.pricingPeriod.trim() !== "daily"
    ) {
      throw new ServicesHttpError(
        400,
        "pricingPeriod must be daily for book listings",
      );
    }
  }

  if (input.isAvailable !== undefined) {
    if (typeof input.isAvailable !== "boolean") {
      throw new ServicesHttpError(400, "isAvailable must be a boolean");
    }
    updatePayload.isAvailable = input.isAvailable;
  }

  if (Object.keys(updatePayload).length === 0) {
    throw new ServicesHttpError(400, "No booking settings to update");
  }

  const updated = await Service.findByIdAndUpdate(service._id, updatePayload, {
    new: true,
  }).lean();
  if (!updated) {
    throw new ServicesHttpError(404, "Service not found");
  }

  const repopulated = await Service.findById(updated._id)
    .populate<{ serviceCategoryId: PopulatedCategory | null }>(
      "serviceCategoryId",
      "name slug departments",
    )
    .lean();
  if (!repopulated) {
    throw new ServicesHttpError(404, "Service not found");
  }
  return mapLeanServiceToDto(repopulated as LeanPopulatedService);
}

export type HourlyBookingDayDto = {
  date: string;
  kind: HourlyDayKind;
  windows: TimeRange[];
  freeSlots: { start: string; end: string }[];
};

export type BookingAvailabilityDto = {
  bookingWindow: BookingWindow | null;
  hourlyBookingSchedule: HourlyBookingSchedule | null;
  bookingGapMinutes: number;
  bookingGapHours: number;
  price: number | null;
  pricingPeriod: PricingPeriod | null;
  busyIntervals: { start: string; end: string }[];
  freeRanges: { start: string; end: string }[];
  /** Present when pricingPeriod is hourly */
  days?: HourlyBookingDayDto[];
};

function intervalToIso(i: TimeInterval): { start: string; end: string } {
  return { start: i.start.toISOString(), end: i.end.toISOString() };
}

export async function getBookingAvailability(
  serviceId: string,
  fromRaw: string,
  toRaw: string,
): Promise<BookingAvailabilityDto> {
  const trimmed = serviceId?.trim() ?? "";
  if (!trimmed || !mongoose.Types.ObjectId.isValid(trimmed)) {
    throw new ServicesHttpError(400, "serviceId must be a valid ObjectId");
  }
  const from = new Date(fromRaw);
  const to = new Date(toRaw);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new ServicesHttpError(400, "from and to must be valid ISO date-times");
  }
  if (to.getTime() <= from.getTime()) {
    throw new ServicesHttpError(400, "to must be after from");
  }
  const maxRangeMs = 90 * 86400000;
  if (to.getTime() - from.getTime() > maxRangeMs) {
    throw new ServicesHttpError(400, "Date range must be at most 90 days");
  }

  const doc = await Service.findById(trimmed).lean();
  if (!doc) {
    throw new ServicesHttpError(404, "Service not found");
  }
  if (doc.listingType !== "book") {
    throw new ServicesHttpError(400, "This listing is not a book listing");
  }
  if (doc.isAvailable === false) {
    throw new ServicesHttpError(400, "This listing is not currently available");
  }

  const bookingWindow = parseBookingWindowFromDoc(doc.bookingWindow);
  const hourlySchedule = resolveHourlyBookingSchedule(
    doc.hourlyBookingSchedule,
    doc.bookingWindow,
  );
  const gapMinutes =
    typeof doc.bookingGapMinutes === "number" && doc.bookingGapMinutes >= 0
      ? doc.bookingGapMinutes
      : 0;
  const gapHours = gapMinutesToHours(gapMinutes);

  const pricingPeriod: PricingPeriod = "daily";
  const price = typeof doc.price === "number" ? doc.price : null;

  if (!bookingWindow && !hasValidHourlySchedule(hourlySchedule)) {
    return {
      bookingWindow: null,
      hourlyBookingSchedule: hourlySchedule,
      bookingGapMinutes: gapMinutes,
      bookingGapHours: gapHours,
      price,
      pricingPeriod,
      busyIntervals: [],
      freeRanges: [],
      days: [],
    };
  }

  const busy = await loadBusyBookIntervals(trimmed, from, to);

  if (hasValidHourlySchedule(hourlySchedule)) {
    const segments = buildHourlySegments(hourlySchedule, from, to);
    const free = computeFreeRanges(segments, busy, gapMinutes);
    const freeIso = free.map(intervalToIso);

    const days: HourlyBookingDayDto[] = enumerateLagosDates(from, to).map((date) => {
      const { kind, windows } = getScheduledWindowsForDate(hourlySchedule, date);
      const daySegments = segments.filter((s) => lagosDateString(s.start) === date);
      const dayFree = computeFreeRanges(daySegments, busy, gapMinutes);
      return {
        date,
        kind,
        windows,
        freeSlots: dayFree.map(intervalToIso),
      };
    });

    return {
      bookingWindow,
      hourlyBookingSchedule: hourlySchedule,
      bookingGapMinutes: gapMinutes,
      bookingGapHours: gapHours,
      price,
      pricingPeriod,
      busyIntervals: busy.map(intervalToIso),
      freeRanges: freeIso,
      days,
    };
  }

  const weekly = buildWeeklySegments(bookingWindow!, from, to);
  const free = computeFreeRanges(weekly, busy, gapMinutes);
  const freeIso = free.map(intervalToIso);
  const syntheticSchedule: HourlyBookingSchedule = {
    default: bookingWindow!,
    overrides: [],
  };

  const days: HourlyBookingDayDto[] = enumerateLagosDates(from, to).map((date) => {
    const { kind, windows } = getScheduledWindowsForDate(syntheticSchedule, date);
    const daySegments = weekly.filter((s) => lagosDateString(s.start) === date);
    const dayFree = computeFreeRanges(daySegments, busy, gapMinutes);
    return {
      date,
      kind,
      windows,
      freeSlots: dayFree.map(intervalToIso),
    };
  });

  return {
    bookingWindow,
    hourlyBookingSchedule: hourlySchedule,
    bookingGapMinutes: gapMinutes,
    bookingGapHours: gapHours,
    price,
    pricingPeriod,
    busyIntervals: busy.map(intervalToIso),
    freeRanges: freeIso,
    days,
  };
}
