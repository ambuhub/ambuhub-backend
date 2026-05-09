import mongoose from "mongoose";
import { Service } from "../../models/service.model";
import { ServiceCategory } from "../../models/serviceCategory.model";

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
const BOOK_LISTING_TYPE_CATEGORY_SLUGS = new Set([
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
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

const MARKETPLACE_LISTING_CAP = 200;

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

export interface CreateServiceInput {
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
    normalizedPrice !== null
  ) {
    throw new ServicesHttpError(
      400,
      "price must be null unless listingType is 'sale' or 'hire'"
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

  if (effectiveListingType === "hire") {
    if (normalizedPricingPeriod === null) {
      throw new ServicesHttpError(
        400,
        "pricingPeriod is required when listingType is 'hire'"
      );
    }
  } else if (normalizedPricingPeriod !== null) {
    throw new ServicesHttpError(
      400,
      "pricingPeriod must be null unless listingType is 'hire'"
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
    isAvailable: true,
  });

  return doc.toObject();
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

  const updated = await Service.findByIdAndUpdate(
    service._id,
    {
      title: normalized.title,
      description: normalized.description,
      serviceCategoryId: category._id,
      departmentSlug: normalized.departmentSlug,
      listingType: normalized.listingType,
      stock: normalized.stock,
      price: normalized.price,
      pricingPeriod: normalized.pricingPeriod,
      photoUrls: normalized.photoUrls,
    },
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
