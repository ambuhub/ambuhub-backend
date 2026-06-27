import type { SupportedCurrency } from "../../shared/currency/types";
import type { SubscriptionInterval } from "../../models/pending-subscription-checkout.model";

export const PREMIUM_SUBSCRIPTION_PRICES: Record<
  SubscriptionInterval,
  Record<SupportedCurrency, number>
> = {
  monthly: { NGN: 10_000, GHS: 100 },
  yearly: { NGN: 100_000, GHS: 1_000 },
};

export function getPremiumSubscriptionPrice(
  interval: SubscriptionInterval,
  currency: SupportedCurrency,
): number {
  return PREMIUM_SUBSCRIPTION_PRICES[interval][currency];
}

export function addSubscriptionInterval(
  from: Date,
  interval: SubscriptionInterval,
): Date {
  const result = new Date(from);
  if (interval === "monthly") {
    result.setUTCMonth(result.getUTCMonth() + 1);
  } else {
    result.setUTCFullYear(result.getUTCFullYear() + 1);
  }
  return result;
}

export function yearlySavingsPercent(currency: SupportedCurrency): number {
  const monthly = PREMIUM_SUBSCRIPTION_PRICES.monthly[currency] * 12;
  const yearly = PREMIUM_SUBSCRIPTION_PRICES.yearly[currency];
  if (monthly <= 0) {
    return 0;
  }
  return Math.round(((monthly - yearly) / monthly) * 100);
}
