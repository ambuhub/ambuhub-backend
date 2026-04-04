import type { Request, Response } from "express";
import { logger } from "../../shared/lib/logger";
import {
  getServiceCategoryBySlug,
  listServiceCategories,
  ServiceCategoryHttpError,
} from "./serviceCategories.service";

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
