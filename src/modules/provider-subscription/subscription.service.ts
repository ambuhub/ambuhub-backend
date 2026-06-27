import mongoose from "mongoose";
import {
  generatePaystackReference,
  getPaystackCallbackUrl,
  getPaystackPublicKey,
  isPaystackEnabled,
  paystackInitializeTransaction,
  paystackVerifyTransaction,
  toPaystackSubunits,
} from "../../config/paystack";
import {
  PendingSubscriptionCheckout,
  type SubscriptionInterval,
} from "../../models/pending-subscription-checkout.model";
import { ServiceProvider } from "../../models/serviceProvider.model";
import { User } from "../../models/user.model";
import {
  type SupportedCurrency,
} from "../../shared/currency/types";
import { currencyForCountry } from "../../shared/currency/countryCurrency";
import { isActivePremiumSubscription } from "../../shared/subscription/activePremium";
import {
  addSubscriptionInterval,
  getPremiumSubscriptionPrice,
} from "./subscription.pricing";

const PENDING_TTL_MS = 30 * 60 * 1000;

export class SubscriptionHttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "SubscriptionHttpError";
  }
}

export type ProviderSubscriptionDto = {
  plan: "free" | "premium";
  interval: SubscriptionInterval | null;
  expiresAt: string | null;
  isActive: boolean;
};

export type PaystackInitializeResponse = {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
  publicKey: string;
  amount: number;
  currency: string;
  email: string;
};

export type SubscriptionVerifyResult = {
  subscription: ProviderSubscriptionDto;
  message: string;
};

function paystackFailureStatusCode(message: string): number {
  const lower = message.toLowerCase();
  if (lower.includes("currency not supported")) {
    return 422;
  }
  if (lower.includes("not configured")) {
    return 503;
  }
  return 502;
}

function throwPaystackSubscriptionError(err: unknown, fallbackMessage: string): never {
  const message =
    err instanceof Error && err.message.trim()
      ? err.message.trim()
      : fallbackMessage;
  throw new SubscriptionHttpError(paystackFailureStatusCode(message), message);
}

function assertPaystackReady(): void {
  if (!isPaystackEnabled()) {
    throw new SubscriptionHttpError(503, "Paystack is not configured on the server.");
  }
}

function parseSubscriptionInterval(value: unknown): SubscriptionInterval {
  if (value === "monthly" || value === "yearly") {
    return value;
  }
  throw new SubscriptionHttpError(400, "interval must be monthly or yearly");
}

async function loadProviderCurrency(userId: string): Promise<SupportedCurrency> {
  const user = await User.findById(userId).select("countryCode").lean();
  return currencyForCountry(user?.countryCode);
}

function mapProviderSubscription(doc: {
  subscriptionPlan?: string | null;
  subscriptionInterval?: string | null;
  subscriptionExpiresAt?: Date | null;
}): ProviderSubscriptionDto {
  const expiresAt =
    doc.subscriptionExpiresAt != null
      ? new Date(doc.subscriptionExpiresAt).toISOString()
      : null;
  const isActive = isActivePremiumSubscription(doc);

  return {
    plan: isActive ? "premium" : "free",
    interval:
      isActive && (doc.subscriptionInterval === "monthly" || doc.subscriptionInterval === "yearly")
        ? doc.subscriptionInterval
        : null,
    expiresAt: isActive ? expiresAt : null,
    isActive,
  };
}

async function loadProviderByUserId(userId: string) {
  const provider = await ServiceProvider.findOne({
    userId: new mongoose.Types.ObjectId(userId),
  }).lean();
  if (!provider) {
    throw new SubscriptionHttpError(403, "Service provider profile not found.");
  }
  return provider;
}

async function loadProviderEmail(userId: string): Promise<string> {
  const user = await User.findById(userId).select("email countryCode").lean();
  if (!user?.email) {
    throw new SubscriptionHttpError(400, "Account email is required for checkout.");
  }
  return user.email;
}

export async function getProviderSubscription(
  userId: string,
): Promise<ProviderSubscriptionDto> {
  const provider = await loadProviderByUserId(userId);
  const subscription = mapProviderSubscription(provider);

  if (
    provider.subscriptionPlan === "premium" &&
    provider.subscriptionExpiresAt != null &&
    !isActivePremiumSubscription(provider)
  ) {
    await ServiceProvider.updateOne(
      { _id: provider._id },
      {
        $set: {
          subscriptionPlan: "free",
          subscriptionInterval: null,
          subscriptionExpiresAt: null,
        },
      },
    );
  }

  return subscription;
}

export async function initializePremiumSubscriptionCheckout(
  userId: string,
  body: unknown,
): Promise<PaystackInitializeResponse> {
  assertPaystackReady();
  await loadProviderByUserId(userId);

  const interval = parseSubscriptionInterval(
    typeof body === "object" && body !== null
      ? (body as { interval?: unknown }).interval
      : undefined,
  );
  const email = await loadProviderEmail(userId);
  const currency = await loadProviderCurrency(userId);
  const amountMajor = getPremiumSubscriptionPrice(interval, currency);
  const amountSubunits = toPaystackSubunits(amountMajor);

  if (amountSubunits < 100) {
    throw new SubscriptionHttpError(400, "Subscription amount is below the Paystack minimum.");
  }

  const reference = generatePaystackReference();

  let init;
  try {
    init = await paystackInitializeTransaction({
      email,
      amountSubunits,
      currency,
      reference,
      callbackUrl: getPaystackCallbackUrl("/provider/subscription"),
      metadata: {
        userId,
        kind: "provider_subscription",
        interval,
        checkoutReference: reference,
      },
    });
  } catch (err) {
    throwPaystackSubscriptionError(err, "Paystack could not initialize payment");
  }

  await PendingSubscriptionCheckout.create({
    userId: new mongoose.Types.ObjectId(userId),
    reference: init.reference,
    interval,
    amountSubunits,
    currency,
    status: "pending",
    expiresAt: new Date(Date.now() + PENDING_TTL_MS),
  });

  return {
    authorizationUrl: init.authorizationUrl,
    accessCode: init.accessCode,
    reference: init.reference,
    publicKey: getPaystackPublicKey(),
    amount: amountSubunits,
    currency,
    email,
  };
}

export async function verifyPremiumSubscriptionCheckout(
  userId: string,
  referenceInput: unknown,
): Promise<SubscriptionVerifyResult> {
  assertPaystackReady();
  const reference =
    typeof referenceInput === "string" ? referenceInput.trim() : "";
  if (!reference) {
    throw new SubscriptionHttpError(400, "reference is required");
  }

  const provider = await loadProviderByUserId(userId);
  const current = mapProviderSubscription(provider);
  if (current.isActive) {
    const pending = await PendingSubscriptionCheckout.findOne({
      reference,
      userId: new mongoose.Types.ObjectId(userId),
      status: "completed",
    }).lean();
    if (pending) {
      return {
        subscription: current,
        message: "Subscription is already active.",
      };
    }
  }

  const pending = await PendingSubscriptionCheckout.findOne({
    reference,
    userId: new mongoose.Types.ObjectId(userId),
  }).lean();

  if (!pending) {
    throw new SubscriptionHttpError(404, "Checkout session not found or expired.");
  }

  if (pending.status === "cancelled" || pending.status === "expired") {
    throw new SubscriptionHttpError(409, "This checkout session is no longer active.");
  }

  if (pending.status === "completed") {
    const subscription = await getProviderSubscription(userId);
    return {
      subscription,
      message: "Subscription is already active.",
    };
  }

  if (pending.expiresAt.getTime() < Date.now()) {
    await PendingSubscriptionCheckout.updateOne(
      { _id: pending._id },
      { $set: { status: "expired" } },
    );
    throw new SubscriptionHttpError(410, "Checkout session expired. Please start again.");
  }

  let verification;
  try {
    verification = await paystackVerifyTransaction(reference);
  } catch (err) {
    throwPaystackSubscriptionError(err, "Paystack could not verify payment");
  }

  if (verification.status !== "success") {
    throw new SubscriptionHttpError(402, "Payment was not successful. Please try again.");
  }

  if (verification.amount !== pending.amountSubunits) {
    throw new SubscriptionHttpError(400, "Paid amount does not match the checkout total.");
  }

  const paidAt = verification.paidAt ? new Date(verification.paidAt) : new Date();
  const baseDate =
    provider.subscriptionExpiresAt != null &&
    new Date(provider.subscriptionExpiresAt).getTime() > paidAt.getTime()
      ? new Date(provider.subscriptionExpiresAt)
      : paidAt;
  const subscriptionExpiresAt = addSubscriptionInterval(baseDate, pending.interval);

  await ServiceProvider.updateOne(
    { _id: provider._id },
    {
      $set: {
        subscriptionPlan: "premium",
        subscriptionInterval: pending.interval,
        subscriptionExpiresAt,
      },
    },
  );

  await PendingSubscriptionCheckout.updateOne(
    { _id: pending._id },
    { $set: { status: "completed" } },
  );

  const subscription = await getProviderSubscription(userId);
  return {
    subscription,
    message: "Premium subscription activated successfully.",
  };
}

export async function cancelPremiumSubscriptionCheckout(
  userId: string,
  referenceInput: unknown,
): Promise<void> {
  const reference =
    typeof referenceInput === "string" ? referenceInput.trim() : "";
  if (!reference) {
    throw new SubscriptionHttpError(400, "reference is required");
  }

  await PendingSubscriptionCheckout.updateOne(
    {
      reference,
      userId: new mongoose.Types.ObjectId(userId),
      status: "pending",
    },
    { $set: { status: "cancelled" } },
  );
}
