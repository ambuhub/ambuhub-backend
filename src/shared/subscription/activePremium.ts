export function isActivePremiumSubscription(provider: {
  subscriptionPlan?: string | null;
  subscriptionExpiresAt?: Date | string | null;
}): boolean {
  return (
    provider.subscriptionPlan === "premium" &&
    provider.subscriptionExpiresAt != null &&
    new Date(provider.subscriptionExpiresAt).getTime() > Date.now()
  );
}
