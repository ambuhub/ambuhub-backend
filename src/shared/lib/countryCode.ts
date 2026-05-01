import worldCountries from "world-countries";

const VALID_ALPHA2 = new Set(
  worldCountries
    .filter((c) => typeof c.cca2 === "string" && c.cca2.length === 2)
    .map((c) => c.cca2.toUpperCase()),
);

/**
 * Returns uppercase ISO 3166-1 alpha-2 if valid, otherwise null.
 */
export function normalizeCountryCode(input: string): string | null {
  const t = input?.trim().toUpperCase() ?? "";
  if (!t || !/^[A-Z]{2}$/.test(t)) {
    return null;
  }
  if (!VALID_ALPHA2.has(t)) {
    return null;
  }
  return t;
}

/** True if `input` is a known ISO 3166-1 alpha-2 code (any case, surrounding space ignored). */
export function isValidCountryCode(input: string): boolean {
  return normalizeCountryCode(input) !== null;
}
