import crypto from "crypto";
import Paystack from "@paystack/paystack-sdk";
import { logger } from "../shared/lib/logger";

export const PAYSTACK_API_BASE = "https://api.paystack.co";

export type PaystackInitializeResult = {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
};

export type PaystackVerifyResult = {
  status: string;
  amount: number;
  currency: string;
  paidAt: string | null;
};

let configured = false;
let secretKey: string | null = null;
let publicKey: string | null = null;
let client: Paystack | null = null;

function detectPaystackMode(key: string): "test" | "live" | "unknown" {
  if (key.includes("_test_")) {
    return "test";
  }
  if (key.includes("_live_")) {
    return "live";
  }
  return "unknown";
}

/**
 * Load Paystack from environment variables.
 * Safe to call on every server start; skips configuration if credentials are missing.
 *
 * Required when enabled (set both in `.env`):
 * - PAYSTACK_SECRET_KEY (sk_test_* or sk_live_*)
 * - PAYSTACK_PUBLIC_KEY (pk_test_* or pk_live_*)
 */
export function initPaystack(): boolean {
  const secret = process.env.PAYSTACK_SECRET_KEY?.trim();
  const public_ = process.env.PAYSTACK_PUBLIC_KEY?.trim();

  if (!secret || !public_) {
    logger.warn(
      "Paystack not configured: set PAYSTACK_SECRET_KEY and PAYSTACK_PUBLIC_KEY to enable payments"
    );
    configured = false;
    secretKey = null;
    publicKey = null;
    client = null;
    return false;
  }

  if (!secret.startsWith("sk_")) {
    logger.warn(
      "PAYSTACK_SECRET_KEY should start with sk_test_ or sk_live_"
    );
  }
  if (!public_.startsWith("pk_")) {
    logger.warn(
      "PAYSTACK_PUBLIC_KEY should start with pk_test_ or pk_live_"
    );
  }

  secretKey = secret;
  publicKey = public_;
  client = new Paystack(secret);
  configured = true;

  const secretMode = detectPaystackMode(secret);
  const publicMode = detectPaystackMode(public_);
  if (
    secretMode !== "unknown" &&
    publicMode !== "unknown" &&
    secretMode !== publicMode
  ) {
    logger.warn("Paystack key mode mismatch: secret and public keys should both be test or both be live");
  }

  logger.info("Paystack configured", {
    mode: secretMode === "unknown" ? publicMode : secretMode,
  });
  return true;
}

export function isPaystackEnabled(): boolean {
  return configured;
}

export function isPaystackTestMode(): boolean {
  if (!secretKey) {
    return false;
  }
  return detectPaystackMode(secretKey) === "test";
}

/**
 * Server-side SDK client. Throws if `initPaystack()` did not succeed.
 */
export function getPaystack(): Paystack {
  if (!client) {
    throw new Error(
      "Paystack is not configured. Set PAYSTACK_SECRET_KEY and PAYSTACK_PUBLIC_KEY, then ensure initPaystack() ran at startup."
    );
  }
  return client;
}

/**
 * Public key for client-side Paystack Inline / Popup (expose via a safe API route).
 */
export function getPaystackPublicKey(): string {
  if (!publicKey) {
    throw new Error(
      "Paystack public key is not configured. Set PAYSTACK_PUBLIC_KEY and ensure initPaystack() ran at startup."
    );
  }
  return publicKey;
}

/**
 * Default redirect URL after Paystack checkout (override per transaction if needed).
 */
export function getPaystackCallbackUrl(path = "/checkout"): string {
  const frontend = process.env.FRONTEND_URL?.trim() || "http://localhost:3000";
  return new URL(path, frontend).toString();
}

export function generatePaystackReference(): string {
  return `AMB-${crypto.randomUUID().replace(/-/g, "").slice(0, 24).toUpperCase()}`;
}

/** Convert major currency units (NGN/GHS) to Paystack subunits (kobo/pesewas). */
export function toPaystackSubunits(amountMajor: number): number {
  return Math.round(amountMajor * 100);
}

function requireSecretKey(): string {
  if (!secretKey) {
    throw new Error("Paystack secret key is not configured");
  }
  return secretKey;
}

export async function paystackInitializeTransaction(input: {
  email: string;
  amountSubunits: number;
  currency: string;
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}): Promise<PaystackInitializeResult> {
  const res = await fetch(`${PAYSTACK_API_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      amount: input.amountSubunits,
      currency: input.currency,
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    }),
  });

  const json = (await res.json()) as {
    status?: boolean;
    message?: string;
    data?: {
      authorization_url?: string;
      access_code?: string;
      reference?: string;
    };
  };

  if (!res.ok || !json.status || !json.data?.authorization_url || !json.data.reference) {
    throw new Error(json.message ?? "Paystack could not initialize payment");
  }

  return {
    authorizationUrl: json.data.authorization_url,
    accessCode: json.data.access_code ?? "",
    reference: json.data.reference,
  };
}

export async function paystackVerifyTransaction(
  reference: string,
): Promise<PaystackVerifyResult> {
  const res = await fetch(
    `${PAYSTACK_API_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${requireSecretKey()}`,
      },
    },
  );

  const json = (await res.json()) as {
    status?: boolean;
    message?: string;
    data?: {
      status?: string;
      amount?: number;
      currency?: string;
      paid_at?: string;
    };
  };

  if (!res.ok || !json.status || !json.data) {
    throw new Error(json.message ?? "Paystack could not verify payment");
  }

  return {
    status: json.data.status ?? "failed",
    amount: json.data.amount ?? 0,
    currency: json.data.currency ?? "NGN",
    paidAt: json.data.paid_at ?? null,
  };
}

export { Paystack };
