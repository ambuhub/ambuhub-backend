import fs from "fs";
import { cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";
import type { SendResponse } from "firebase-admin/messaging";
import { logger } from "../lib/logger";

let initialized = false;
let fcmEnabled = false;

function loadServiceAccount(): ServiceAccount | null {
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (path) {
    try {
      const raw = fs.readFileSync(path, "utf8");
      return JSON.parse(raw) as ServiceAccount;
    } catch (err) {
      throw new Error(
        `Failed to read FIREBASE_SERVICE_ACCOUNT_PATH (${path}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY?.trim();

  if (!projectId || !clientEmail || !privateKeyRaw) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey: privateKeyRaw.replace(/\\n/g, "\n"),
  };
}

function missingCredentialKeys(): string[] {
  const missing: string[] = [];
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim()) {
    return missing;
  }
  if (!process.env.FIREBASE_PROJECT_ID?.trim()) {
    missing.push("FIREBASE_PROJECT_ID");
  }
  if (!process.env.FIREBASE_CLIENT_EMAIL?.trim()) {
    missing.push("FIREBASE_CLIENT_EMAIL");
  }
  if (!process.env.FIREBASE_PRIVATE_KEY?.trim()) {
    missing.push("FIREBASE_PRIVATE_KEY");
  }
  return missing;
}

/**
 * Initialize Firebase Admin SDK. In production, missing/invalid credentials fail fast.
 * In development, logs a warning and continues without FCM.
 */
export function initFirebaseAdmin(): void {
  if (initialized) {
    return;
  }

  const isProduction = process.env.NODE_ENV === "production";
  const account = loadServiceAccount();

  if (!account) {
    const missing = missingCredentialKeys();
    const message =
      missing.length > 0
        ? `Firebase Admin credentials missing: ${missing.join(", ")}`
        : "Firebase Admin credentials could not be loaded";

    if (isProduction) {
      throw new Error(`${message}. FCM is required in production.`);
    }

    logger.warn(`${message}. Push notifications disabled in development.`);
    initialized = true;
    fcmEnabled = false;
    return;
  }

  try {
    if (getApps().length === 0) {
      initializeApp({
        credential: cert(account),
      });
    }
    fcmEnabled = true;
    initialized = true;
    logger.info("Firebase Admin initialized for FCM");
  } catch (err) {
    const message = `Firebase Admin initialization failed: ${err instanceof Error ? err.message : String(err)}`;
    if (isProduction) {
      throw new Error(message);
    }
    logger.warn(`${message}. Push notifications disabled in development.`);
    initialized = true;
    fcmEnabled = false;
  }
}

export function isFcmEnabled(): boolean {
  return fcmEnabled;
}

export function getFirebaseMessaging(): Messaging | null {
  if (!fcmEnabled) {
    return null;
  }
  return getMessaging();
}

export type { SendResponse };
