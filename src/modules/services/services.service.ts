import mongoose from "mongoose";
import { Service } from "../../models/service.model";
import { ServiceCategory } from "../../models/serviceCategory.model";

export type ListingType = "sale" | "rent";
const PERSONNEL_CATEGORY_SLUG = "personnel";
const AMBULANCE_SERVICING_CATEGORY_SLUG = "ambulance-servicing";
const NULL_LISTING_TYPE_CATEGORY_SLUGS = new Set([
  PERSONNEL_CATEGORY_SLUG,
  AMBULANCE_SERVICING_CATEGORY_SLUG,
]);

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

  return {
    id: doc._id.toString(),
    title: doc.title,
    description: doc.description,
    listingType: doc.listingType ?? null,
    departmentSlug: doc.departmentSlug,
    departmentName,
    category,
    photoUrls: Array.isArray(doc.photoUrls) ? doc.photoUrls : [],
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

const MARKETPLACE_LISTING_CAP = 200;

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
    query = { serviceCategoryId: category._id };
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

export interface CreateServiceInput {
  title: string;
  description: string;
  serviceCategorySlug: string;
  departmentSlug: string;
  listingType?: string | null;
  photoUrls?: string[];
}

export async function createService(
  userId: string,
  input: CreateServiceInput
) {
  const {
    title,
    description,
    serviceCategorySlug,
    departmentSlug,
    listingType,
    photoUrls = [],
  } = input;

  if (
    !title?.trim() ||
    !description?.trim() ||
    !serviceCategorySlug?.trim() ||
    !departmentSlug?.trim()
  ) {
    throw new ServicesHttpError(
      400,
      "title, description, serviceCategorySlug, and departmentSlug are required"
    );
  }

  const category = await ServiceCategory.findOne({
    slug: serviceCategorySlug.trim(),
  }).lean();

  if (!category) {
    throw new ServicesHttpError(404, "Service category not found");
  }

  const deptSlugs = category.departments.map((d) => d.slug);
  if (!deptSlugs.includes(departmentSlug.trim())) {
    throw new ServicesHttpError(
      400,
      "departmentSlug is not valid for this category"
    );
  }

  const normalizedListingType = (() => {
    if (listingType === null || listingType === undefined) {
      return null;
    }
    if (typeof listingType !== "string") {
      throw new ServicesHttpError(
        400,
        "listingType must be 'sale' or 'rent' for non-personnel categories"
      );
    }
    const trimmed = listingType.trim();
    if (trimmed === "") {
      return null;
    }
    if (trimmed === "sale" || trimmed === "rent") {
      return trimmed;
    }
    throw new ServicesHttpError(
      400,
      "listingType must be 'sale' or 'rent' for non-personnel categories"
    );
  })();

  const mustUseNullListingType = NULL_LISTING_TYPE_CATEGORY_SLUGS.has(category.slug);

  if (mustUseNullListingType && normalizedListingType !== null) {
    throw new ServicesHttpError(
      400,
      "listingType must be null for personnel and ambulance-servicing categories"
    );
  }

  if (!mustUseNullListingType && normalizedListingType === null) {
    throw new ServicesHttpError(
      400,
      "listingType is required and must be 'sale' or 'rent' for this category"
    );
  }

  const normalizedUrls = Array.isArray(photoUrls)
    ? photoUrls.filter((u) => typeof u === "string" && u.trim().length > 0)
    : [];

  const doc = await Service.create({
    title: title.trim(),
    description: description.trim(),
    userId: new mongoose.Types.ObjectId(userId),
    serviceCategoryId: category._id,
    listingType: normalizedListingType,
    departmentSlug: departmentSlug.trim(),
    photoUrls: normalizedUrls,
  });

  return doc.toObject();
}
