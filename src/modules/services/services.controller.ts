import type { Request, Response } from "express";
import {
  createService,
  listMarketplaceServices,
  listMyServices,
  ServicesHttpError,
} from "./services.service";

export async function getMarketplaceServices(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const raw = req.query.categorySlug;
    const categorySlug =
      raw === undefined
        ? undefined
        : Array.isArray(raw)
          ? typeof raw[0] === "string"
            ? raw[0]
            : null
          : typeof raw === "string"
            ? raw
            : null;

    if (categorySlug === null) {
      res.status(400).json({ message: "categorySlug must be a string" });
      return;
    }

    const { services, bannerUrl } = await listMarketplaceServices(categorySlug);
    res.status(200).json({ services, bannerUrl });
  } catch (err: unknown) {
    if (err instanceof ServicesHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    throw err;
  }
}

export async function getMyServices(
  req: Request,
  res: Response
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const services = await listMyServices(req.auth.userId);
    res.status(200).json({ services });
  } catch (err: unknown) {
    if (err instanceof ServicesHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    throw err;
  }
}

export async function postCreateService(
  req: Request,
  res: Response
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const photoUrls = Array.isArray(body.photoUrls)
      ? (body.photoUrls as unknown[]).map((u) => String(u))
      : undefined;
    const listingTypeRaw = body.listingType;
    const listingType =
      listingTypeRaw === null || listingTypeRaw === undefined
        ? null
        : typeof listingTypeRaw === "string"
          ? listingTypeRaw
          : undefined;

    const service = await createService(req.auth.userId, {
      title: String(body.title ?? ""),
      description: String(body.description ?? ""),
      serviceCategorySlug: String(body.serviceCategorySlug ?? ""),
      departmentSlug: String(body.departmentSlug ?? ""),
      listingType,
      photoUrls,
    });

    res.status(201).json({ service });
  } catch (err: unknown) {
    if (err instanceof ServicesHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    throw err;
  }
}
