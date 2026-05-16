import mongoose from "mongoose";
import { Service } from "../../models/service.model";
import { User } from "../../models/user.model";
import { ServiceCategory } from "../../models/serviceCategory.model";
import {
  buildWeeklySegments,
  computeFreeRanges,
  loadBusyBookIntervals,
  normalizeBookingGapMinutes,
  type TimeInterval,
} from "../../shared/lib/booking-availability";
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
  normalizeServiceLocation,
  resolveStateProvinceName,
  type ServiceLocationInput,
} from "../../shared/lib/serviceLocation";

export type ListingType = "sale" | "hire" | "book";

export type PricingPeriod =
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly";

const PRICING_PERIODS = new Set<PricingPeriod>([
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly",
]);

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
  bookingGapMinutes: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Public listing card shape (same fields as MyServiceDto; no owner data). */
export type MarketplaceServiceDto = MyServiceDto;

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
  pricingPeriod?: PricingPeriod | null;
  isAvailable?: boolean | null;
  departmentSlug: string;
  photoUrls: unknown;
  countryCode?: string | null;
  stateProvince?: string | null;
  officeAddress?: string | null;
  hireReturnWindow?: unknown;
  bookingWindow?: unknown;
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

  const rawPeriod = doc.pricingPeriod;
  const pricingPeriod: PricingPeriod | null =
    typeof rawPeriod === "string" && PRICING_PERIODS.has(rawPeriod as PricingPeriod)
      ? (rawPeriod as PricingPeriod)
      : null;

  return {
    id: doc._id.toString(),
    title: doc.title,
    description: doc.description,
    listingType: doc.listingType ?? null,
    stock: typeof doc.stock === "number" ? doc.stock : null,
    price: typeof doc.price === "number" ? doc.price : null,
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
    bookingGapMinutes:
      typeof doc.bookingGapMinutes === "number" && Number.isInteger(doc.bookingGapMinutes)
        ? doc.bookingGapMinutes
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

export async function listMarketplaceServices(
  categorySlug?: string
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

  const rows = await Service.find(query)
    .populate<{ serviceCategoryId: PopulatedCategory | null }>(
      "serviceCategoryId",
      "name slug departments"
    )
    .sort({ createdAt: -1 })
    .limit(MARKETPLACE_LISTING_CAP)
    .lean();

  return {
    services: rows.map((doc) => mapLeanServiceToDto(doc as LeanPopulatedService)),
    bannerUrl,
  };
}

export async function getMarketplaceServiceById(
  serviceId: string,
): Promise<MarketplaceServiceDto> {
  const trimmed = serviceId?.trim() ?? "";
  if (!trimmed || !mongoose.Types.ObjectId.isValid(trimmed)) {
    throw new ServicesHttpError(400, "serviceId must be a valid ObjectId");
  }

  const doc = await Service.findOne({
    _id: new mongoose.Types.ObjectId(trimmed),
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

  if (!doc) {
    throw new ServicesHttpError(404, "Service not found");
  }

  return mapLeanServiceToDto(doc as LeanPopulatedService);
}

export async function listFavoriteServicesForUser(
  userId: string,
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
        "pricingPeriod must be one of: hourly, daily, weekly, monthly, yearly"
      );
    }
    return trimmed as PricingPeriod;
  })();

  if (effectiveListingType === "hire" || effectiveListingType === "book") {
    if (normalizedPricingPeriod === null && effectiveListingType === "hire") {
      throw new ServicesHttpError(
        400,
        "pricingPeriod is required when listingType is 'hire'"
      );
    }
  } else if (normalizedPricingPeriod !== null) {
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
    pricingPeriod: normalizedPricingPeriod,
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

  const doc = await Service.create({
    title: normalized.title,
    description: normalized.description,
    userId: new mongoose.Types.ObjectId(userId),
    serviceCategoryId: category._id,
    listingType: normalized.listingType,
    stock: normalized.stock,
    price: normalized.price,
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

  const updatePayload: Record<string, unknown> = {};

  if (hasBookingWindowInput(input)) {
    let bookingWindow: BookingWindow | null = null;
    try {
      bookingWindow = normalizeBookingWindow(input.bookingWindow, { required: true });
    } catch (err) {
      wrapBookingWindowError(err);
    }
    updatePayload.bookingWindow = bookingWindow;
  }

  if (input.bookingGapMinutes !== undefined) {
    try {
      updatePayload.bookingGapMinutes = normalizeBookingGapMinutes(input.bookingGapMinutes);
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
  }

  if (input.pricingPeriod !== undefined) {
    if (input.pricingPeriod === null || input.pricingPeriod === "") {
      updatePayload.pricingPeriod = null;
    } else if (
      typeof input.pricingPeriod === "string" &&
      PRICING_PERIODS.has(input.pricingPeriod.trim() as PricingPeriod)
    ) {
      updatePayload.pricingPeriod = input.pricingPeriod.trim();
    } else {
      throw new ServicesHttpError(
        400,
        "pricingPeriod must be one of: hourly, daily, weekly, monthly, yearly",
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

export type BookingAvailabilityDto = {
  bookingWindow: BookingWindow | null;
  bookingGapMinutes: number;
  price: number | null;
  pricingPeriod: PricingPeriod | null;
  busyIntervals: { start: string; end: string }[];
  freeRanges: { start: string; end: string }[];
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
  const gapMinutes =
    typeof doc.bookingGapMinutes === "number" && doc.bookingGapMinutes >= 0
      ? doc.bookingGapMinutes
      : 0;

  const rawPeriod = doc.pricingPeriod;
  const pricingPeriod: PricingPeriod | null =
    typeof rawPeriod === "string" && PRICING_PERIODS.has(rawPeriod as PricingPeriod)
      ? (rawPeriod as PricingPeriod)
      : null;

  if (!bookingWindow) {
    return {
      bookingWindow: null,
      bookingGapMinutes: gapMinutes,
      price: typeof doc.price === "number" ? doc.price : null,
      pricingPeriod,
      busyIntervals: [],
      freeRanges: [],
    };
  }

  const busy = await loadBusyBookIntervals(trimmed, from, to);
  const weekly = buildWeeklySegments(bookingWindow, from, to);
  const free = computeFreeRanges(weekly, busy, gapMinutes);

  return {
    bookingWindow,
    bookingGapMinutes: gapMinutes,
    price: typeof doc.price === "number" ? doc.price : null,
    pricingPeriod,
    busyIntervals: busy.map(intervalToIso),
    freeRanges: free.map(intervalToIso),
  };
}
