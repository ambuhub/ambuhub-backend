import type { Request, Response } from "express";
import { logger } from "../../shared/lib/logger";
import {
  createServiceCategory,
  type CreateServiceCategoryInput,
  getServiceCategoryBySlug,
  listServiceCategories,
  ServiceCategoryHttpError,
  updateServiceCategoryBySlug,
} from "./serviceCategories.service";

/**
 * POST /api/service-categories — create a category not in the code catalog.
 * Body: name (required); optional departments[{ name }], note, thumbnailUrl, bannerUrl.
 * Category and department slugs are generated on the server (client must not send slugs).
 * Rows are stored with catalogManaged: false so startup seed does not delete them.
 * WARNING: No authentication in this version. Lock down before production.
 */
export async function postCreateServiceCategoryHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const body = req.body as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(body, "slug")) {
      res.status(400).json({
        message: "slug must not be sent; it is generated from name on the server",
      });
      return;
    }
    const name = body.name;
    const departments = body.departments;

    if (typeof name !== "string") {
      res.status(400).json({ message: "name is required" });
      return;
    }
    if (
      departments !== undefined &&
      departments !== null &&
      !Array.isArray(departments)
    ) {
      res.status(400).json({ message: "departments must be an array when provided" });
      return;
    }

    const deptList =
      departments === undefined || departments === null ? [] : departments;

    const parsedDepts: { name: string }[] = [];
    for (const d of deptList) {
      if (d === null || typeof d !== "object") {
        res.status(400).json({ message: "Each department must be an object" });
        return;
      }
      const o = d as Record<string, unknown>;
      if (Object.prototype.hasOwnProperty.call(o, "slug")) {
        res.status(400).json({
          message:
            "department slug must not be sent; it is generated from name on the server",
        });
        return;
      }
      if (typeof o.name !== "string") {
        res.status(400).json({ message: "Each department needs a string name" });
        return;
      }
      parsedDepts.push({ name: o.name });
    }

    const input: CreateServiceCategoryInput = {
      name,
      departments: parsedDepts,
    };

    if (Object.prototype.hasOwnProperty.call(body, "thumbnailUrl")) {
      const v = body.thumbnailUrl;
      if (v === null) {
        input.thumbnailUrl = null;
      } else if (typeof v === "string") {
        input.thumbnailUrl = v;
      } else {
        res.status(400).json({ message: "thumbnailUrl must be a string or null" });
        return;
      }
    }
    if (Object.prototype.hasOwnProperty.call(body, "bannerUrl")) {
      const v = body.bannerUrl;
      if (v === null) {
        input.bannerUrl = null;
      } else if (typeof v === "string") {
        input.bannerUrl = v;
      } else {
        res.status(400).json({ message: "bannerUrl must be a string or null" });
        return;
      }
    }
    if (Object.prototype.hasOwnProperty.call(body, "note")) {
      const v = body.note;
      if (v === null) {
        input.note = null;
      } else if (typeof v === "string") {
        input.note = v;
      } else {
        res.status(400).json({ message: "note must be a string or null" });
        return;
      }
    }

    const serviceCategory = await createServiceCategory(input);
    res.status(201).json({ serviceCategory });
  } catch (err) {
    if (err instanceof ServiceCategoryHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    logger.error("create service category failed", { error: err });
    res.status(500).json({ message: "Failed to create service category" });
  }
}

export async function listServiceCategoriesHandler(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const serviceCategories = await listServiceCategories();
    res.status(200).json({ serviceCategories });
  } catch (err) {
    logger.error("list service categories failed", { error: err });
    res.status(500).json({ message: "Failed to load service categories" });
  }
}

export async function getServiceCategoryBySlugHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const raw = req.params.slug;
    const slug = Array.isArray(raw) ? raw[0] : raw;
    if (!slug?.trim()) {
      res.status(400).json({ message: "Slug is required" });
      return;
    }
    const serviceCategory = await getServiceCategoryBySlug(slug);
    res.status(200).json({ serviceCategory });
  } catch (err) {
    if (err instanceof ServiceCategoryHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    logger.error("get service category failed", { error: err });
    res.status(500).json({ message: "Failed to load service category" });
  }
}

/**
 * PUT /api/service-categories/:slug — partial update (thumbnailUrl, bannerUrl, note).
 * WARNING: No authentication in this version. Lock down (secret header, admin
 * role, or network rules) before production.
 */
export async function putServiceCategoryBySlugHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const raw = req.params.slug;
    const slug = Array.isArray(raw) ? raw[0] : raw;
    if (!slug?.trim()) {
      res.status(400).json({ message: "Slug is required" });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const input: {
      thumbnailUrl?: string | null;
      bannerUrl?: string | null;
      note?: string | null;
    } = {};

    if (Object.prototype.hasOwnProperty.call(body, "thumbnailUrl")) {
      const v = body.thumbnailUrl;
      if (v === null) {
        input.thumbnailUrl = null;
      } else if (typeof v === "string") {
        input.thumbnailUrl = v;
      } else if (v !== undefined) {
        res.status(400).json({ message: "thumbnailUrl must be a string or null" });
        return;
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, "bannerUrl")) {
      const v = body.bannerUrl;
      if (v === null) {
        input.bannerUrl = null;
      } else if (typeof v === "string") {
        input.bannerUrl = v;
      } else if (v !== undefined) {
        res.status(400).json({ message: "bannerUrl must be a string or null" });
        return;
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, "note")) {
      const v = body.note;
      if (v === null) {
        input.note = null;
      } else if (typeof v === "string") {
        input.note = v;
      } else if (v !== undefined) {
        res.status(400).json({ message: "note must be a string or null" });
        return;
      }
    }

    const serviceCategory = await updateServiceCategoryBySlug(slug, input);
    res.status(200).json({ serviceCategory });
  } catch (err) {
    if (err instanceof ServiceCategoryHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    logger.error("update service category failed", { error: err });
    res.status(500).json({ message: "Failed to update service category" });
  }
}
