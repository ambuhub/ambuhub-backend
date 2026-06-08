import { DEFAULT_CURRENCY, type SupportedCurrency } from "./types";

export const MARKETPLACE_COUNTRY_CODES = ["NG", "GH"] as const;

export type MarketplaceCountryCode = (typeof MARKETPLACE_COUNTRY_CODES)[number];

const COUNTRY_TO_CURRENCY: Record<MarketplaceCountryCode, SupportedCurrency> = {
  NG: "NGN",
  GH: "GHS",
};

export function isMarketplaceCountry(
  countryCode: string | null | undefined,
): countryCode is MarketplaceCountryCode {
  const trimmed = countryCode?.trim().toUpperCase() ?? "";
  return trimmed === "NG" || trimmed === "GH";
}

export function parseMarketplaceCountry(
  countryCode: string | null | undefined,
  fallback: MarketplaceCountryCode = "NG",
): MarketplaceCountryCode {
  const trimmed = countryCode?.trim().toUpperCase() ?? "";
  if (trimmed === "NG" || trimmed === "GH") {
    return trimmed;
  }
  return fallback;
}

/** Listing/wallet currency from NG or GH country code. */
export function currencyForCountry(
  countryCode: string | null | undefined,
): SupportedCurrency {
  const trimmed = countryCode?.trim().toUpperCase() ?? "";
  if (trimmed === "GH") {
    return "GHS";
  }
  if (trimmed === "NG") {
    return "NGN";
  }
  return DEFAULT_CURRENCY;
}

/** Provider wallet currency from signup country (NG/GH only for providers). */
export function resolveUserCurrency(
  countryCode: string | null | undefined,
): SupportedCurrency {
  return currencyForCountry(countryCode);
}
