export const SUPPORTED_CURRENCIES = ["NGN", "GHS"] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const DEFAULT_CURRENCY: SupportedCurrency = "NGN";

export function isSupportedCurrency(value: unknown): value is SupportedCurrency {
  return (
    typeof value === "string" &&
    (SUPPORTED_CURRENCIES as readonly string[]).includes(value)
  );
}

export function parseSupportedCurrency(
  value: unknown,
  fallback: SupportedCurrency = DEFAULT_CURRENCY,
): SupportedCurrency {
  if (typeof value === "string") {
    const upper = value.trim().toUpperCase();
    if (isSupportedCurrency(upper)) {
      return upper;
    }
  }
  return fallback;
}
