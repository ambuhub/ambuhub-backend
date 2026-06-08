import { Service } from "../../models/service.model";
import {
  isMarketplaceCountry,
  parseMarketplaceCountry,
  type MarketplaceCountryCode,
} from "./countryCurrency";

export type MarketplaceCountrySource = "geo" | "fallback";

export function detectCountryFromRequest(headers: {
  "cf-ipcountry"?: string;
  "x-vercel-ip-country"?: string;
}): string | null {
  const cf = headers["cf-ipcountry"]?.trim().toUpperCase();
  if (cf && cf.length === 2 && cf !== "XX") {
    return cf;
  }
  const vercel = headers["x-vercel-ip-country"]?.trim().toUpperCase();
  if (vercel && vercel.length === 2) {
    return vercel;
  }
  return null;
}

const MARKETPLACE_AVAILABLE_FILTER = {
  $or: [{ isAvailable: true }, { isAvailable: { $exists: false } }],
};

export async function getDominantListingCountry(): Promise<MarketplaceCountryCode> {
  const rows = await Service.aggregate<{ _id: string; count: number }>([
    {
      $match: {
        ...MARKETPLACE_AVAILABLE_FILTER,
        countryCode: { $in: ["NG", "GH"] },
      },
    },
    { $group: { _id: "$countryCode", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 1 },
  ]);

  const top = rows[0]?._id;
  if (top === "GH") {
    return "GH";
  }
  return "NG";
}

export async function resolveMarketplaceCountry(input: {
  geoCountry?: string | null;
  queryCountry?: string | null;
}): Promise<{ countryCode: MarketplaceCountryCode; source: MarketplaceCountrySource }> {
  if (input.queryCountry && isMarketplaceCountry(input.queryCountry)) {
    return {
      countryCode: parseMarketplaceCountry(input.queryCountry),
      source: "geo",
    };
  }

  if (input.geoCountry && isMarketplaceCountry(input.geoCountry)) {
    return {
      countryCode: parseMarketplaceCountry(input.geoCountry),
      source: "geo",
    };
  }

  return {
    countryCode: await getDominantListingCountry(),
    source: "fallback",
  };
}
