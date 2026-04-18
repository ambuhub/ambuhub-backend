import mongoose from "mongoose";
import { ServiceCategory } from "../../models/serviceCategory.model";
import { logger } from "../../shared/lib/logger";
import { SERVICE_CATEGORY_CATALOG } from "./serviceCategories.catalog";

export class ServiceCategoryHttpError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "ServiceCategoryHttpError";
  }
}

function toDepartmentPayload(
  departments: (typeof SERVICE_CATEGORY_CATALOG)[0]["departments"]
) {
  return departments.map((d, order) => ({
    name: d.name,
    slug: d.slug,
    order,
  }));
}

/**
 * Upserts the full catalog so the database stays aligned with code.
 * Safe to run on every server start.
 */
export async function ensureServiceCategoryCatalogSeeded(): Promise<void> {
  for (const item of SERVICE_CATEGORY_CATALOG) {
    await ServiceCategory.findOneAndUpdate(
      { slug: item.slug },
      {
        $set: {
          name: item.name,
          slug: item.slug,
          departments: toDepartmentPayload(item.departments),
          catalogManaged: true,
        },
      },
      { upsert: true, returnDocument: "after" }
    );
  }

  const allowedSlugs = SERVICE_CATEGORY_CATALOG.map((c) => c.slug);
  const pruneResult = await ServiceCategory.deleteMany({
    slug: { $nin: allowedSlugs },
    $or: [
      { catalogManaged: true },
      { catalogManaged: { $exists: false } },
    ],
  });
  if (pruneResult.deletedCount > 0) {
    logger.info("Removed obsolete service categories not in catalog", {
      deletedCount: pruneResult.deletedCount,
    });
  }

  logger.info("Service category catalog seeded", {
    count: SERVICE_CATEGORY_CATALOG.length,
  });
}

type ServiceCategoryLean = {
  _id: { toString(): string };
  name: string;
  slug: string;
  departments: { name: string; slug: string; order: number }[];
  thumbnailUrl?: string | null;
  bannerUrl?: string | null;
  note?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toServiceCategoryDto(doc: ServiceCategoryLean) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    slug: doc.slug,
    departments: [...doc.departments].sort((a, b) => a.order - b.order),
    ...(doc.thumbnailUrl != null && doc.thumbnailUrl !== ""
      ? { thumbnailUrl: doc.thumbnailUrl }
      : {}),
    ...(doc.bannerUrl != null && doc.bannerUrl !== ""
      ? { bannerUrl: doc.bannerUrl }
      : {}),
    ...(doc.note != null && doc.note !== "" ? { note: doc.note } : {}),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function listServiceCategories() {
  const rows = await ServiceCategory.find().sort({ name: 1 }).lean();
  return rows.map((doc) => toServiceCategoryDto(doc as ServiceCategoryLean));
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** URL-safe slug from a display name (ASCII, lowercase, hyphens). */
export function slugifyFromName(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 80);
  const base = s || "category";
  return SLUG_PATTERN.test(base) ? base : "category";
}

function uniqueSlugWithinSet(base: string, used: Set<string>): string {
  let candidate = base;
  let n = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  used.add(candidate);
  return candidate;
}

async function allocateUniqueCategorySlug(base: string): Promise<string> {
  let candidate = base;
  let n = 2;
  const maxAttempts = 10_000;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const taken = await ServiceCategory.findOne({ slug: candidate }).lean();
    if (!taken) {
      return candidate;
    }
    candidate = `${base}-${n}`;
    n += 1;
  }
  throw new ServiceCategoryHttpError(500, "Could not allocate a unique category slug");
}

export interface CreateServiceCategoryInput {
  name: string;
  /** Omitted or empty: category is created with no departments (add later or via catalog tooling). */
  departments?: { name: string }[];
  thumbnailUrl?: string | null;
  bannerUrl?: string | null;
  note?: string | null;
}

/**
 * Create a category not defined in SERVICE_CATEGORY_CATALOG.
 * Category and department slugs are generated server-side from names.
 * Persists with catalogManaged: false so seed pruning does not remove it.
 */
export async function createServiceCategory(input: CreateServiceCategoryInput) {
  const name = input.name?.trim();
  if (!name) {
    throw new ServiceCategoryHttpError(400, "name is required");
  }

  const departments = Array.isArray(input.departments)
    ? input.departments
    : [];

  const usedDeptSlugs = new Set<string>();
  const normalizedDepts: { name: string; slug: string; order: number }[] = [];
  for (let i = 0; i < departments.length; i++) {
    const d = departments[i];
    const dn = typeof d?.name === "string" ? d.name.trim() : "";
    if (!dn) {
      throw new ServiceCategoryHttpError(
        400,
        "Each department must have a non-empty name"
      );
    }
    const base = slugifyFromName(dn);
    const ds = uniqueSlugWithinSet(base, usedDeptSlugs);
    normalizedDepts.push({ name: dn, slug: ds, order: i });
  }

  const categoryBase = slugifyFromName(name);
  const slug = await allocateUniqueCategorySlug(categoryBase);

  const doc: Record<string, unknown> = {
    name,
    slug,
    departments: normalizedDepts,
    catalogManaged: false,
  };

  if (input.thumbnailUrl != null && String(input.thumbnailUrl).trim() !== "") {
    doc.thumbnailUrl = String(input.thumbnailUrl).trim();
  }
  if (input.bannerUrl != null && String(input.bannerUrl).trim() !== "") {
    doc.bannerUrl = String(input.bannerUrl).trim();
  }
  if (input.note != null && String(input.note).trim() !== "") {
    const n = String(input.note).trim();
    if (n.length > 500) {
      throw new ServiceCategoryHttpError(400, "note must be at most 500 characters");
    }
    doc.note = n;
  }

  const created = await ServiceCategory.create(doc);
  return toServiceCategoryDto(created.toObject() as ServiceCategoryLean);
}

export async function getServiceCategoryBySlug(slug: string) {
  const doc = await ServiceCategory.findOne({ slug: slug.trim() }).lean();
  if (!doc) {
    throw new ServiceCategoryHttpError(404, "Service category not found");
  }
  return toServiceCategoryDto(doc as ServiceCategoryLean);
}

export interface UpdateServiceCategoryInput {
  thumbnailUrl?: string | null;
  bannerUrl?: string | null;
  note?: string | null;
}

/**
 * Partial update by slug. thumbnailUrl, bannerUrl, note are writable.
 * Pass null or "" to clear a field.
 */
export async function updateServiceCategoryBySlug(
  slug: string,
  input: UpdateServiceCategoryInput
) {
  const trimmed = slug.trim();
  if (!trimmed) {
    throw new ServiceCategoryHttpError(400, "Slug is required");
  }

  const hasThumbnail = Object.prototype.hasOwnProperty.call(
    input,
    "thumbnailUrl"
  );
  const hasBanner = Object.prototype.hasOwnProperty.call(input, "bannerUrl");
  const hasNote = Object.prototype.hasOwnProperty.call(input, "note");

  if (!hasThumbnail && !hasBanner && !hasNote) {
    throw new ServiceCategoryHttpError(
      400,
      "Provide at least one of thumbnailUrl, bannerUrl, note"
    );
  }

  const $set: Record<string, string> = {};
  const $unset: Record<string, 1> = {};

  if (hasThumbnail) {
    const v = input.thumbnailUrl;
    if (v === null || v === "") {
      $unset.thumbnailUrl = 1;
    } else if (typeof v === "string") {
      const t = v.trim();
      if (!t) {
        $unset.thumbnailUrl = 1;
      } else {
        $set.thumbnailUrl = t;
      }
    } else {
      throw new ServiceCategoryHttpError(400, "thumbnailUrl must be a string");
    }
  }

  if (hasBanner) {
    const v = input.bannerUrl;
    if (v === null || v === "") {
      $unset.bannerUrl = 1;
    } else if (typeof v === "string") {
      const t = v.trim();
      if (!t) {
        $unset.bannerUrl = 1;
      } else {
        $set.bannerUrl = t;
      }
    } else {
      throw new ServiceCategoryHttpError(400, "bannerUrl must be a string");
    }
  }

  if (hasNote) {
    const v = input.note;
    if (v === null || v === "") {
      $unset.note = 1;
    } else if (typeof v === "string") {
      const t = v.trim();
      if (!t) {
        $unset.note = 1;
      } else if (t.length > 500) {
        throw new ServiceCategoryHttpError(
          400,
          "note must be at most 500 characters"
        );
      } else {
        $set.note = t;
      }
    } else {
      throw new ServiceCategoryHttpError(400, "note must be a string");
    }
  }

  const update: mongoose.UpdateQuery<unknown> = {};
  if (Object.keys($set).length > 0) {
    update.$set = $set;
  }
  if (Object.keys($unset).length > 0) {
    update.$unset = $unset;
  }

  const doc = await ServiceCategory.findOneAndUpdate(
    { slug: trimmed },
    update,
    { new: true, runValidators: true }
  ).lean();

  if (!doc) {
    throw new ServiceCategoryHttpError(404, "Service category not found");
  }

  return toServiceCategoryDto(doc as ServiceCategoryLean);
}
