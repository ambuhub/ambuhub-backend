/**
 * End-to-end push notification verification script.
 *
 * Usage (backend must be running on PORT from .env):
 *   npx ts-node --transpile-only src/scripts/e2e-push-notifications.ts
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDatabase } from "../config/database";
import { initFirebaseAdmin, isFcmEnabled } from "../shared/firebase/firebase-admin";
import { DeviceToken } from "../models/device-token.model";
import { NotificationTemplates } from "../modules/notifications/notification-templates";
import { NotificationService } from "../modules/notifications/notification.service";
import { User } from "../models/user.model";

dotenv.config();

const API_BASE = `http://127.0.0.1:${process.env.PORT ?? 3002}/api`;

const USERS = {
  client: {
    email: "dark.darlene10@gmail.com",
    password: "12345678",
  },
  provider: {
    email: "dolphines@gmail.com",
    password: "12345678",
  },
  admin: {
    email: "admin@gmail.com",
    password: "12345678",
  },
} as const;

type Role = keyof typeof USERS;

type AuthSession = {
  role: Role;
  token: string;
  userId: string;
  email: string;
};

function fakeFcmToken(role: Role): string {
  const suffix = Date.now().toString(36);
  return `e2e:${role}:${suffix}:abcdefghijklmnopqrstuvwxyz0123456789abcdef`;
}

function parseTokenFromSetCookie(setCookie: string | null): string | null {
  if (!setCookie) {
    return null;
  }
  const match = setCookie.match(/ambuhub_access_token=([^;]+)/);
  return match?.[1] ?? null;
}

async function apiFetch(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<Response> {
  const headers = new Headers(options.headers);
  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  const user = await User.findOne({ email: email.trim().toLowerCase() })
    .select("_id role")
    .lean();
  return user?._id?.toString() ?? null;
}

async function loginOrSkip(role: Role): Promise<AuthSession | null> {
  try {
    return await login(role);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logStep(`${role} login`, false, message);
    return null;
  }
}

async function login(role: Role): Promise<AuthSession> {
  const creds = USERS[role];
  const res = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: creds.email, password: creds.password }),
  });
  const data = (await res.json()) as {
    user?: { id: string; email: string };
    message?: string;
  };
  if (!res.ok || !data.user?.id) {
    throw new Error(`${role} login failed (${res.status}): ${data.message ?? "unknown"}`);
  }
  const token =
    parseTokenFromSetCookie(res.headers.get("set-cookie")) ??
    (() => {
      throw new Error(`${role} login: no auth token in Set-Cookie`);
    })();
  return {
    role,
    token,
    userId: data.user.id,
    email: data.user.email,
  };
}

async function registerDevice(session: AuthSession, fcmToken: string): Promise<void> {
  const res = await apiFetch("/notifications/me/devices", {
    method: "PUT",
    token: session.token,
    body: JSON.stringify({
      fcmToken,
      platform: "web",
      deviceName: `e2e-${session.role}`,
    }),
  });
  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(
      `${session.role} device register failed (${res.status}): ${data.message ?? "unknown"}`,
    );
  }
}

async function getUnreadCount(session: AuthSession): Promise<number> {
  const path =
    session.role === "admin"
      ? "/admin/notifications/unread-count"
      : "/notifications/me/unread-count";
  const res = await apiFetch(path, { token: session.token });
  const data = (await res.json()) as { count?: number; message?: string };
  if (!res.ok) {
    throw new Error(`${session.role} unread count failed: ${data.message}`);
  }
  return data.count ?? 0;
}

async function submitConciergeRequest(client: AuthSession): Promise<string> {
  const res = await apiFetch("/concierge/requests", {
    method: "POST",
    token: client.token,
    body: JSON.stringify({
      name: "E2E Push Test",
      phone: "+2348000000000",
      email: client.email,
      countryCode: "NG",
      inquiryType: "other",
      categorySlug: "something-else",
      departmentSlug: "something-else",
      description: "Automated e2e push notification test request from script.",
    }),
  });
  const data = (await res.json()) as {
    request?: { id: string };
    id?: string;
    message?: string;
  };
  const requestId = data.request?.id ?? data.id;
  if (!res.ok || !requestId) {
    throw new Error(`Concierge submit failed (${res.status}): ${data.message ?? "unknown"}`);
  }
  return requestId;
}

async function waitForAdminConciergeNotification(
  admin: AuthSession,
  requestId: string,
  timeoutMs = 15_000,
): Promise<{
  id: string;
  deepLink: string | null;
  title: string;
}> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await apiFetch("/admin/notifications?limit=20", {
      token: admin.token,
    });
    const data = (await res.json()) as {
      notifications?: Array<{
        id: string;
        title: string;
        deepLink?: string | null;
        entityId?: string | null;
        conciergeRequestId?: string | null;
      }>;
    };
    const match = data.notifications?.find(
      (n) =>
        n.conciergeRequestId === requestId ||
        n.entityId === requestId ||
        n.deepLink?.includes(requestId),
    );
    if (match) {
      return {
        id: match.id,
        deepLink: match.deepLink ?? null,
        title: match.title,
      };
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Admin notification for concierge ${requestId} not found within ${timeoutMs}ms`);
}

async function verifyDeviceTokenInDb(userId: string, fcmToken: string): Promise<boolean> {
  const row = await DeviceToken.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    fcmToken,
  }).lean();
  return Boolean(row);
}

function logStep(label: string, ok: boolean, detail?: string): void {
  const icon = ok ? "PASS" : "FAIL";
  console.log(`[${icon}] ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main(): Promise<void> {
  console.log("\n=== AmbuHub Push Notification E2E ===\n");
  console.log(`API: ${API_BASE}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV ?? "undefined"}\n`);

  // 1. Firebase init (same as server boot)
  try {
    initFirebaseAdmin();
    logStep("Firebase Admin init", isFcmEnabled(), isFcmEnabled() ? "FCM enabled" : "FCM disabled");
  } catch (err) {
    logStep("Firebase Admin init", false, err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  // 2. Server reachable
  let serverUp = false;
  try {
    const res = await fetch(`${API_BASE}/auth/login`, { method: "OPTIONS" }).catch(() => null);
    serverUp = res !== null;
  } catch {
    serverUp = false;
  }
  if (!serverUp) {
    try {
      await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "x@y.com", password: "bad" }),
      });
      serverUp = true;
    } catch {
      serverUp = false;
    }
  }
  if (!serverUp) {
    logStep("Backend server reachable", false, "Start backend first: npm run dev");
    process.exit(1);
  }
  logStep("Backend server reachable", true);

  // 3. Login all roles (client + admin required; provider optional if password mismatch)
  await connectDatabase();

  const sessions: Partial<Record<Role, AuthSession>> = {};
  for (const role of ["client", "admin"] as const) {
    const session = await loginOrSkip(role);
    if (!session) {
      process.exit(1);
    }
    sessions[role] = session;
    logStep(`${role} login`, true, session.userId);
  }

  const providerSession = await loginOrSkip("provider");
  if (providerSession) {
    sessions.provider = providerSession;
    logStep("provider login", true, providerSession.userId);
  } else {
    const providerUserId = await findUserIdByEmail(USERS.provider.email);
    if (providerUserId) {
      logStep("provider user lookup (DB fallback)", true, providerUserId);
    } else {
      logStep("provider user lookup (DB fallback)", false, "user not found");
    }
  }

  // 4. Register device tokens
  const tokens: Partial<Record<Role, string>> = {};
  for (const role of ["admin", "client"] as const) {
    const session = sessions[role]!;
    tokens[role] = fakeFcmToken(role);
    try {
      await registerDevice(session, tokens[role]!);
      logStep(`${role} device token registered`, true, tokens[role]!.slice(0, 24) + "…");
    } catch (err) {
      logStep(`${role} device token registered`, false, err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  }

  if (sessions.provider) {
    tokens.provider = fakeFcmToken("provider");
    try {
      await registerDevice(sessions.provider, tokens.provider);
      logStep("provider device token registered", true, tokens.provider.slice(0, 24) + "…");
    } catch (err) {
      logStep("provider device token registered", false, err instanceof Error ? err.message : String(err));
    }
  }

  for (const role of ["admin", "client"] as const) {
    const exists = await verifyDeviceTokenInDb(sessions[role]!.userId, tokens[role]!);
    logStep(`${role} token persisted in MongoDB`, exists);
  }

  const adminUnreadBefore = await getUnreadCount(sessions.admin!);
  logStep("Admin unread count (before)", true, String(adminUnreadBefore));

  // 5. Trigger admin notification via concierge request
  let requestId: string;
  try {
    requestId = await submitConciergeRequest(sessions.client!);
    logStep("Client concierge request submitted", true, requestId);
  } catch (err) {
    logStep("Client concierge request submitted", false, err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  let adminNotification: { id: string; deepLink: string | null; title: string };
  try {
    adminNotification = await waitForAdminConciergeNotification(sessions.admin!, requestId);
    logStep("Admin in-app notification created", true, adminNotification.title);
    logStep(
      "Admin notification deepLink",
      Boolean(adminNotification.deepLink?.includes(requestId)),
      adminNotification.deepLink ?? "missing",
    );
  } catch (err) {
    logStep("Admin in-app notification created", false, err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const adminUnreadAfter = await getUnreadCount(sessions.admin!);
  logStep(
    "Admin unread count increased",
    adminUnreadAfter > adminUnreadBefore,
    `${adminUnreadBefore} → ${adminUnreadAfter}`,
  );

  const providerUserId =
    sessions.provider?.userId ??
    (await findUserIdByEmail(USERS.provider.email));

  if (providerUserId) {
    try {
      if (sessions.provider && !tokens.provider) {
        tokens.provider = fakeFcmToken("provider");
        await DeviceToken.findOneAndUpdate(
          {
            userId: new mongoose.Types.ObjectId(providerUserId),
            fcmToken: tokens.provider,
          },
          {
            userId: new mongoose.Types.ObjectId(providerUserId),
            fcmToken: tokens.provider,
            platform: "web",
            deviceName: "e2e-provider",
            lastSeenAt: new Date(),
          },
          { upsert: true, new: true },
        );
        logStep("provider device token seeded (DB)", true);
      }

      const template = NotificationTemplates.providerSalePurchased({
        orderId: new mongoose.Types.ObjectId().toString(),
        serviceId: new mongoose.Types.ObjectId().toString(),
        serviceTitle: "E2E Test Listing",
        receiptNumber: "E2E-TEST",
      });
      const dto = await NotificationService.send(providerUserId, template);
      logStep("Provider notification saved", Boolean(dto?.id), dto?.title ?? "no dto");
      logStep(
        "Provider notification deepLink",
        dto?.deepLink === "/provider/listings",
        dto?.deepLink ?? "missing",
      );
    } catch (err) {
      logStep("Provider notification + FCM send", false, err instanceof Error ? err.message : String(err));
    }
  } else {
    logStep("Provider notification + FCM send", false, "skipped — provider user not found");
  }

  // 7. FCM note — fake tokens are expected to fail delivery and may be pruned
  const adminTokenExists = await verifyDeviceTokenInDb(
    sessions.admin!.userId,
    tokens.admin!,
  );
  logStep(
    "Admin device token after FCM attempt",
    true,
    adminTokenExists
      ? "still registered (FCM may not have rejected yet)"
      : "pruned (expected for fake e2e token)",
  );

  console.log("\n--- Notes ---");
  console.log("• In-app notifications and deepLinks were verified via API.");
  console.log("• FCM multicast runs when isFcmEnabled() is true and tokens exist.");
  console.log("• Fake e2e tokens cannot receive real browser push — use the web app");
  console.log("  (grant notification permission) to test live push delivery.");
  console.log("• With NODE_ENV=production, auth cookies use secure=true — use HTTPS");
  console.log("  in the browser or Bearer tokens for local API testing.\n");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("\nE2E script failed:", err);
  process.exit(1);
});
