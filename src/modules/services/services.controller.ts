import type { Request, Response } from "express";
import {
  addFavoriteServiceForUser,
  createService,
  deleteService,
  getBookingAvailability,
  getMarketplaceServiceById,
  getMyServiceById,
  listFavoriteServicesForUser,
  listMarketplaceServices,
  listMyServices,
  removeFavoriteServiceForUser,
  ServicesHttpError,
  setServiceAvailability,
  updateBookingSettings,
  updateService,
} from "./services.service";

type ParsedServicePayload = {
  title: string;
  description: string;
  serviceCategorySlug: string;
  departmentSlug: string;
  listingType: string | null | undefined;
  stock: number | null | undefined;
  price: number | null | undefined;
  pricingPeriod: string | null | undefined;
  photoUrls: string[] | undefined;
  countryCode: string | undefined;
  stateProvince: string | undefined;
  officeAddress: string | undefined;
  hireReturnWindow: unknown;
};

function parseServicePayload(body: Record<string, unknown>): ParsedServicePayload {
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
  const stockRaw = body.stock;
  const stock =
    stockRaw === null || stockRaw === undefined
      ? null
      : typeof stockRaw === "number"
        ? stockRaw
        : typeof stockRaw === "string"
          ? Number(stockRaw)
          : undefined;
  const priceRaw = body.price;
  const price =
    priceRaw === null || priceRaw === undefined
      ? null
      : typeof priceRaw === "number"
        ? priceRaw
        : typeof priceRaw === "string"
          ? Number(priceRaw)
          : undefined;
  const pricingPeriodRaw = body.pricingPeriod;
  const pricingPeriod =
    pricingPeriodRaw === null || pricingPeriodRaw === undefined
      ? null
      : typeof pricingPeriodRaw === "string"
        ? pricingPeriodRaw
        : undefined;

  const countryCode =
    body.countryCode !== undefined && body.countryCode !== null
      ? String(body.countryCode)
      : undefined;
  const stateProvince =
    body.stateProvince !== undefined && body.stateProvince !== null
      ? String(body.stateProvince)
      : undefined;
  const officeAddress =
    body.officeAddress !== undefined && body.officeAddress !== null
      ? String(body.officeAddress)
      : undefined;

  const hireReturnWindow =
    body.hireReturnWindow !== undefined ? body.hireReturnWindow : undefined;

  return {
    title: String(body.title ?? ""),
    description: String(body.description ?? ""),
    serviceCategorySlug: String(body.serviceCategorySlug ?? ""),
    departmentSlug: String(body.departmentSlug ?? ""),
    listingType,
    stock,
    price,
    pricingPeriod,
    photoUrls,
    countryCode,
    stateProvince,
    officeAddress,
    hireReturnWindow,
  };
}

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

export async function getMarketplaceServiceByIdHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const serviceId = typeof req.params.serviceId === "string" ? req.params.serviceId : "";
    const service = await getMarketplaceServiceById(serviceId);
    res.status(200).json({ service });
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

export async function getMyServiceByIdHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const rawId = req.params.serviceId;
    const serviceId = typeof rawId === "string" ? rawId : "";
    const service = await getMyServiceById(req.auth.userId, serviceId);
    res.status(200).json({ service });
  } catch (err: unknown) {
    if (err instanceof ServicesHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    throw err;
  }
}

export async function deleteMyService(
  req: Request,
  res: Response
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const rawId = req.params.id;
    const serviceId = typeof rawId === "string" ? rawId : "";
    await deleteService(req.auth.userId, serviceId);
    res.status(204).send();
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
    const payload = parseServicePayload(body);

    const service = await createService(req.auth.userId, {
      title: payload.title,
      description: payload.description,
      serviceCategorySlug: payload.serviceCategorySlug,
      departmentSlug: payload.departmentSlug,
      listingType: payload.listingType,
      stock: payload.stock,
      price: payload.price,
      pricingPeriod: payload.pricingPeriod,
      photoUrls: payload.photoUrls,
      countryCode: payload.countryCode,
      stateProvince: payload.stateProvince,
      officeAddress: payload.officeAddress,
      hireReturnWindow: payload.hireReturnWindow,
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

export async function putUpdateService(
  req: Request,
  res: Response
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const payload = parseServicePayload(body);
    const rawServiceId = req.params.id;
    const serviceId = typeof rawServiceId === "string" ? rawServiceId : "";

    const service = await updateService(req.auth.userId, {
      serviceId,
      title: payload.title,
      description: payload.description,
      serviceCategorySlug: payload.serviceCategorySlug,
      departmentSlug: payload.departmentSlug,
      listingType: payload.listingType,
      stock: payload.stock,
      price: payload.price,
      pricingPeriod: payload.pricingPeriod,
      photoUrls: payload.photoUrls,
      countryCode: payload.countryCode,
      stateProvince: payload.stateProvince,
      officeAddress: payload.officeAddress,
      hireReturnWindow: payload.hireReturnWindow,
    });

    res.status(200).json({ service });
  } catch (err: unknown) {
    if (err instanceof ServicesHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    throw err;
  }
}

export async function patchServiceAvailability(
  req: Request,
  res: Response
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const rawId = req.params.id;
    const serviceId = typeof rawId === "string" ? rawId : "";
    const body = req.body as Record<string, unknown>;
    const raw = body.isAvailable;

    if (raw !== true && raw !== false) {
      res.status(400).json({ message: "isAvailable must be a boolean" });
      return;
    }

    const service = await setServiceAvailability(
      req.auth.userId,
      serviceId,
      raw
    );
    res.status(200).json({ service });
  } catch (err: unknown) {
    if (err instanceof ServicesHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    throw err;
  }
}

export async function getMyFavoriteServicesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const services = await listFavoriteServicesForUser(req.auth.userId);
    res.status(200).json({ services });
  } catch (err: unknown) {
    if (err instanceof ServicesHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    throw err;
  }
}

export async function postAddFavoriteHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const raw = body.serviceId;
    const serviceId = typeof raw === "string" ? raw : "";
    if (!serviceId.trim()) {
      res.status(400).json({ message: "serviceId is required" });
      return;
    }
    const services = await addFavoriteServiceForUser(
      req.auth.userId,
      serviceId,
    );
    res.status(200).json({ services });
  } catch (err: unknown) {
    if (err instanceof ServicesHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    throw err;
  }
}

export async function getBookingAvailabilityHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const serviceId =
      typeof req.params.serviceId === "string" ? req.params.serviceId : "";
    const from = typeof req.query.from === "string" ? req.query.from : "";
    const to = typeof req.query.to === "string" ? req.query.to : "";
    if (!from || !to) {
      res.status(400).json({ message: "from and to query parameters are required" });
      return;
    }
    const availability = await getBookingAvailability(serviceId, from, to);
    res.status(200).json(availability);
  } catch (err: unknown) {
    if (err instanceof ServicesHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    throw err;
  }
}

export async function patchBookingSettingsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const serviceId =
      typeof req.params.serviceId === "string" ? req.params.serviceId : "";
    const body = req.body as Record<string, unknown>;
    const priceRaw = body.price;
    const price =
      priceRaw === undefined
        ? undefined
        : priceRaw === null
          ? null
          : typeof priceRaw === "number"
            ? priceRaw
            : typeof priceRaw === "string"
              ? Number(priceRaw)
              : undefined;
    const pricingPeriodRaw = body.pricingPeriod;
    const pricingPeriod =
      pricingPeriodRaw === undefined
        ? undefined
        : pricingPeriodRaw === null
          ? null
          : typeof pricingPeriodRaw === "string"
            ? pricingPeriodRaw
            : undefined;
    const isAvailable =
      body.isAvailable === undefined
        ? undefined
        : body.isAvailable === true || body.isAvailable === false
          ? body.isAvailable
          : undefined;
    if (body.isAvailable !== undefined && isAvailable === undefined) {
      res.status(400).json({ message: "isAvailable must be a boolean" });
      return;
    }

    const service = await updateBookingSettings(req.auth.userId, serviceId, {
      bookingWindow: body.bookingWindow,
      bookingGapMinutes: body.bookingGapMinutes,
      price,
      pricingPeriod,
      isAvailable,
    });
    res.status(200).json({ service });
  } catch (err: unknown) {
    if (err instanceof ServicesHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    throw err;
  }
}

export async function deleteFavoriteHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const rawId = req.params.serviceId;
    const serviceId = typeof rawId === "string" ? rawId : "";
    if (!serviceId.trim()) {
      res.status(400).json({ message: "serviceId is required" });
      return;
    }
    const services = await removeFavoriteServiceForUser(
      req.auth.userId,
      serviceId,
    );
    res.status(200).json({ services });
  } catch (err: unknown) {
    if (err instanceof ServicesHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    throw err;
  }
}
