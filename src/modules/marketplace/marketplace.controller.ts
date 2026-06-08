import type { Request, Response } from "express";
import {
  detectCountryFromRequest,
  resolveMarketplaceCountry,
} from "../../shared/currency/resolveMarketplaceCountry";

export async function getMarketplaceCountryHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const queryRaw = req.query.countryCode;
  const queryCountry =
    typeof queryRaw === "string"
      ? queryRaw
      : Array.isArray(queryRaw) && typeof queryRaw[0] === "string"
        ? queryRaw[0]
        : null;

  const geoCountry = detectCountryFromRequest({
    "cf-ipcountry":
      typeof req.headers["cf-ipcountry"] === "string"
        ? req.headers["cf-ipcountry"]
        : undefined,
    "x-vercel-ip-country":
      typeof req.headers["x-vercel-ip-country"] === "string"
        ? req.headers["x-vercel-ip-country"]
        : undefined,
  });

  const result = await resolveMarketplaceCountry({ geoCountry, queryCountry });
  res.status(200).json(result);
}
