import { ServiceCategory } from "../../models/serviceCategory.model";
import {
  createServiceCategory,
  ServiceCategoryHttpError,
  slugifyFromName,
} from "../serviceCategories/serviceCategories.service";

export { ServiceCategoryHttpError as AdminCategoriesHttpError };

type ServiceCategoryLean = {
  _id: { toString(): string };
  name: string;
  slug: string;
  catalogManaged?: boolean;
  departments: { name: string; slug: string; order: number }[];
  thumbnailUrl?: string | null;
  bannerUrl?: string | null;
  note?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminCategoryDepartment = {
  name: string;
  slug: string;
  order: number;
};

export type AdminCategoryDto = {
  id: string;
  name: string;
  slug: string;
  catalogManaged: boolean;
  departments: AdminCategoryDepartment[];
  thumbnailUrl?: string;
  bannerUrl?: string;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
};

function toAdminCategoryDto(doc: ServiceCategoryLean): AdminCategoryDto {
  return {
    id: doc._id.toString(),
    name: doc.name,
    slug: doc.slug,
    catalogManaged: doc.catalogManaged !== false,
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

function applyOptionalImageField(
  field: "thumbnailUrl" | "bannerUrl",
  value: string | null | undefined,
  present: boolean,
  $set: Record<string, string>,
  $unset: Record<string, 1>,
): void {
  if (!present) {
    return;
  }
  if (value === null || value === "") {
    $unset[field] = 1;
    return;
  }
  if (typeof value !== "string") {
    throw new ServiceCategoryHttpError(400, `${field} must be a string or null`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    $unset[field] = 1;
  } else {
    $set[field] = trimmed;
  }
}

export async function listAdminCategories(): Promise<AdminCategoryDto[]> {
  const rows = await ServiceCategory.find().sort({ name: 1 }).lean();
  return rows.map((doc) => toAdminCategoryDto(doc as ServiceCategoryLean));
}

export type CreateAdminCategoryInput = {
  name: string;
  departments?: { name: string }[];
  thumbnailUrl?: string | null;
  bannerUrl?: string | null;
};

export async function createAdminCategory(input: CreateAdminCategoryInput) {
  const created = await createServiceCategory({
    name: input.name,
    departments: input.departments,
    thumbnailUrl: input.thumbnailUrl,
    bannerUrl: input.bannerUrl,
  });
  const doc = await ServiceCategory.findById(created.id).lean();
  if (!doc) {
    throw new ServiceCategoryHttpError(500, "Category was created but could not be loaded");
  }
  return toAdminCategoryDto(doc as ServiceCategoryLean);
}

export type UpdateAdminCategoryInput = {
  name?: string;
  addDepartments?: { name: string }[];
  updateDepartments?: { slug: string; name: string }[];
  thumbnailUrl?: string | null;
  bannerUrl?: string | null;
};

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

export async function updateAdminCategoryBySlug(
  slug: string,
  input: UpdateAdminCategoryInput,
) {
  const trimmed = slug.trim();
  if (!trimmed) {
    throw new ServiceCategoryHttpError(400, "Slug is required");
  }

  const hasName = Object.prototype.hasOwnProperty.call(input, "name");
  const hasThumbnail = Object.prototype.hasOwnProperty.call(input, "thumbnailUrl");
  const hasBanner = Object.prototype.hasOwnProperty.call(input, "bannerUrl");
  const addDepts = input.addDepartments ?? [];
  const updateDepts = input.updateDepartments ?? [];

  if (
    !hasName &&
    !hasThumbnail &&
    !hasBanner &&
    addDepts.length === 0 &&
    updateDepts.length === 0
  ) {
    throw new ServiceCategoryHttpError(
      400,
      "Provide name, thumbnailUrl, bannerUrl, addDepartments, or updateDepartments",
    );
  }

  const doc = await ServiceCategory.findOne({ slug: trimmed }).lean();
  if (!doc) {
    throw new ServiceCategoryHttpError(404, "Service category not found");
  }

  const $set: Record<string, unknown> = { catalogManaged: false };
  const $unset: Record<string, 1> = {};

  applyOptionalImageField(
    "thumbnailUrl",
    input.thumbnailUrl,
    hasThumbnail,
    $set as Record<string, string>,
    $unset,
  );
  applyOptionalImageField(
    "bannerUrl",
    input.bannerUrl,
    hasBanner,
    $set as Record<string, string>,
    $unset,
  );

  const needsNameOrDeptUpdate =
    hasName || addDepts.length > 0 || updateDepts.length > 0;

  if (needsNameOrDeptUpdate) {
    const departments = [...(doc as ServiceCategoryLean).departments].sort(
      (a, b) => a.order - b.order,
    );
    const usedSlugs = new Set(departments.map((d) => d.slug));
    let nextName = (doc as ServiceCategoryLean).name;

    if (hasName) {
      const name = input.name?.trim();
      if (!name) {
        throw new ServiceCategoryHttpError(400, "name must be non-empty");
      }
      nextName = name;
    }

    for (const item of updateDepts) {
      const deptSlug = item.slug?.trim();
      const deptName = item.name?.trim();
      if (!deptSlug || !deptName) {
        throw new ServiceCategoryHttpError(
          400,
          "Each updateDepartments entry needs slug and name",
        );
      }
      const idx = departments.findIndex((d) => d.slug === deptSlug);
      if (idx === -1) {
        throw new ServiceCategoryHttpError(
          404,
          `Department not found: ${deptSlug}`,
        );
      }
      departments[idx] = { ...departments[idx], name: deptName };
    }

    for (const item of addDepts) {
      const deptName = item.name?.trim();
      if (!deptName) {
        throw new ServiceCategoryHttpError(
          400,
          "Each addDepartments entry needs a non-empty name",
        );
      }
      const base = slugifyFromName(deptName);
      const ds = uniqueSlugWithinSet(base, usedSlugs);
      departments.push({ name: deptName, slug: ds, order: departments.length });
    }

    $set.name = nextName;
    $set.departments = departments.map((d, order) => ({
      name: d.name,
      slug: d.slug,
      order,
    }));
  }

  const update: { $set?: Record<string, unknown>; $unset?: Record<string, 1> } =
    {};
  if (Object.keys($set).length > 0) {
    update.$set = $set;
  }
  if (Object.keys($unset).length > 0) {
    update.$unset = $unset;
  }

  const updated = await ServiceCategory.findOneAndUpdate(
    { slug: trimmed },
    update,
    { new: true, runValidators: true },
  ).lean();

  if (!updated) {
    throw new ServiceCategoryHttpError(404, "Service category not found");
  }

  return toAdminCategoryDto(updated as ServiceCategoryLean);
}
