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
        },
      },
      { upsert: true, returnDocument: "after" }
    );
  }

  const allowedSlugs = SERVICE_CATEGORY_CATALOG.map((c) => c.slug);
  const pruneResult = await ServiceCategory.deleteMany({
    slug: { $nin: allowedSlugs },
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

export async function listServiceCategories() {
  const rows = await ServiceCategory.find().sort({ name: 1 }).lean();
  return rows.map((doc) => ({
    id: doc._id.toString(),
    name: doc.name,
    slug: doc.slug,
    departments: [...doc.departments].sort((a, b) => a.order - b.order),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }));
}

export async function getServiceCategoryBySlug(slug: string) {
  const doc = await ServiceCategory.findOne({ slug: slug.trim() }).lean();
  if (!doc) {
    throw new ServiceCategoryHttpError(404, "Service category not found");
  }
  return {
    id: doc._id.toString(),
    name: doc.name,
    slug: doc.slug,
    departments: [...doc.departments].sort((a, b) => a.order - b.order),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
