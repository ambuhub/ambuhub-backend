"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceCategoryHttpError = void 0;
exports.ensureServiceCategoryCatalogSeeded = ensureServiceCategoryCatalogSeeded;
exports.listServiceCategories = listServiceCategories;
exports.slugifyFromName = slugifyFromName;
exports.createServiceCategory = createServiceCategory;
exports.getServiceCategoryBySlug = getServiceCategoryBySlug;
exports.updateServiceCategoryBySlug = updateServiceCategoryBySlug;
const serviceCategory_model_1 = require("../../models/serviceCategory.model");
const logger_1 = require("../../shared/lib/logger");
const serviceCategories_catalog_1 = require("./serviceCategories.catalog");
class ServiceCategoryHttpError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = "ServiceCategoryHttpError";
    }
}
exports.ServiceCategoryHttpError = ServiceCategoryHttpError;
function toDepartmentPayload(departments) {
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
async function ensureServiceCategoryCatalogSeeded() {
    for (const item of serviceCategories_catalog_1.SERVICE_CATEGORY_CATALOG) {
        await serviceCategory_model_1.ServiceCategory.findOneAndUpdate({ slug: item.slug }, {
            $set: {
                name: item.name,
                slug: item.slug,
                departments: toDepartmentPayload(item.departments),
                catalogManaged: true,
            },
        }, { upsert: true, returnDocument: "after" });
    }
    const allowedSlugs = serviceCategories_catalog_1.SERVICE_CATEGORY_CATALOG.map((c) => c.slug);
    const pruneResult = await serviceCategory_model_1.ServiceCategory.deleteMany({
        slug: { $nin: allowedSlugs },
        $or: [
            { catalogManaged: true },
            { catalogManaged: { $exists: false } },
        ],
    });
    if (pruneResult.deletedCount > 0) {
        logger_1.logger.info("Removed obsolete service categories not in catalog", {
            deletedCount: pruneResult.deletedCount,
        });
    }
    logger_1.logger.info("Service category catalog seeded", {
        count: serviceCategories_catalog_1.SERVICE_CATEGORY_CATALOG.length,
    });
}
function toServiceCategoryDto(doc) {
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
async function listServiceCategories() {
    const rows = await serviceCategory_model_1.ServiceCategory.find().sort({ name: 1 }).lean();
    return rows.map((doc) => toServiceCategoryDto(doc));
}
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** URL-safe slug from a display name (ASCII, lowercase, hyphens). */
function slugifyFromName(raw) {
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
function uniqueSlugWithinSet(base, used) {
    let candidate = base;
    let n = 2;
    while (used.has(candidate)) {
        candidate = `${base}-${n}`;
        n += 1;
    }
    used.add(candidate);
    return candidate;
}
async function allocateUniqueCategorySlug(base) {
    let candidate = base;
    let n = 2;
    const maxAttempts = 10000;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const taken = await serviceCategory_model_1.ServiceCategory.findOne({ slug: candidate }).lean();
        if (!taken) {
            return candidate;
        }
        candidate = `${base}-${n}`;
        n += 1;
    }
    throw new ServiceCategoryHttpError(500, "Could not allocate a unique category slug");
}
/**
 * Create a category not defined in SERVICE_CATEGORY_CATALOG.
 * Category and department slugs are generated server-side from names.
 * Persists with catalogManaged: false so seed pruning does not remove it.
 */
async function createServiceCategory(input) {
    const name = input.name?.trim();
    if (!name) {
        throw new ServiceCategoryHttpError(400, "name is required");
    }
    const departments = Array.isArray(input.departments)
        ? input.departments
        : [];
    const usedDeptSlugs = new Set();
    const normalizedDepts = [];
    for (let i = 0; i < departments.length; i++) {
        const d = departments[i];
        const dn = typeof d?.name === "string" ? d.name.trim() : "";
        if (!dn) {
            throw new ServiceCategoryHttpError(400, "Each department must have a non-empty name");
        }
        const base = slugifyFromName(dn);
        const ds = uniqueSlugWithinSet(base, usedDeptSlugs);
        normalizedDepts.push({ name: dn, slug: ds, order: i });
    }
    const categoryBase = slugifyFromName(name);
    const slug = await allocateUniqueCategorySlug(categoryBase);
    const doc = {
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
    const created = await serviceCategory_model_1.ServiceCategory.create(doc);
    return toServiceCategoryDto(created.toObject());
}
async function getServiceCategoryBySlug(slug) {
    const doc = await serviceCategory_model_1.ServiceCategory.findOne({ slug: slug.trim() }).lean();
    if (!doc) {
        throw new ServiceCategoryHttpError(404, "Service category not found");
    }
    return toServiceCategoryDto(doc);
}
/**
 * Partial update by slug. thumbnailUrl, bannerUrl, note are writable.
 * Pass null or "" to clear a field.
 */
async function updateServiceCategoryBySlug(slug, input) {
    const trimmed = slug.trim();
    if (!trimmed) {
        throw new ServiceCategoryHttpError(400, "Slug is required");
    }
    const hasThumbnail = Object.prototype.hasOwnProperty.call(input, "thumbnailUrl");
    const hasBanner = Object.prototype.hasOwnProperty.call(input, "bannerUrl");
    const hasNote = Object.prototype.hasOwnProperty.call(input, "note");
    if (!hasThumbnail && !hasBanner && !hasNote) {
        throw new ServiceCategoryHttpError(400, "Provide at least one of thumbnailUrl, bannerUrl, note");
    }
    const $set = {};
    const $unset = {};
    if (hasThumbnail) {
        const v = input.thumbnailUrl;
        if (v === null || v === "") {
            $unset.thumbnailUrl = 1;
        }
        else if (typeof v === "string") {
            const t = v.trim();
            if (!t) {
                $unset.thumbnailUrl = 1;
            }
            else {
                $set.thumbnailUrl = t;
            }
        }
        else {
            throw new ServiceCategoryHttpError(400, "thumbnailUrl must be a string");
        }
    }
    if (hasBanner) {
        const v = input.bannerUrl;
        if (v === null || v === "") {
            $unset.bannerUrl = 1;
        }
        else if (typeof v === "string") {
            const t = v.trim();
            if (!t) {
                $unset.bannerUrl = 1;
            }
            else {
                $set.bannerUrl = t;
            }
        }
        else {
            throw new ServiceCategoryHttpError(400, "bannerUrl must be a string");
        }
    }
    if (hasNote) {
        const v = input.note;
        if (v === null || v === "") {
            $unset.note = 1;
        }
        else if (typeof v === "string") {
            const t = v.trim();
            if (!t) {
                $unset.note = 1;
            }
            else if (t.length > 500) {
                throw new ServiceCategoryHttpError(400, "note must be at most 500 characters");
            }
            else {
                $set.note = t;
            }
        }
        else {
            throw new ServiceCategoryHttpError(400, "note must be a string");
        }
    }
    const update = {};
    if (Object.keys($set).length > 0) {
        update.$set = $set;
    }
    if (Object.keys($unset).length > 0) {
        update.$unset = $unset;
    }
    const doc = await serviceCategory_model_1.ServiceCategory.findOneAndUpdate({ slug: trimmed }, update, { new: true, runValidators: true }).lean();
    if (!doc) {
        throw new ServiceCategoryHttpError(404, "Service category not found");
    }
    return toServiceCategoryDto(doc);
}
