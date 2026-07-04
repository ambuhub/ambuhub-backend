import mongoose from "mongoose";
import type { SendResponse } from "firebase-admin/messaging";
import {
  DeviceToken,
  type DevicePlatform,
} from "../../models/device-token.model";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NotificationPreferences,
} from "../../models/notification-preferences.model";
import {
  AdminNotification,
} from "../../models/adminNotification.model";
import {
  Notification,
  type NotificationCategory,
  type NotificationType,
} from "../../models/notification.model";
import { User } from "../../models/user.model";
import { getFirebaseMessaging, isFcmEnabled } from "../../shared/firebase/firebase-admin";
import { logger } from "../../shared/lib/logger";
import { isHighFcmPriority } from "./notification-categories";
import type { NotificationTemplateResult } from "./notification-templates";

export type NotificationDto = {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  priority: string;
  reminderKind: string | null;
  title: string;
  body: string;
  deepLink: string | null;
  entityId: string | null;
  data: Record<string, unknown>;
  orderId: string | null;
  serviceId: string | null;
  receiptNumber: string | null;
  deadlineAt: string | null;
  readAt: string | null;
  createdAt: string;
};

const INVALID_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

async function shouldDeliver(
  userId: string,
  category: NotificationCategory,
): Promise<boolean> {
  const prefs = await NotificationPreferences.findOne({
    userId: new mongoose.Types.ObjectId(userId),
  }).lean();

  if (!prefs?.categories) {
    return DEFAULT_NOTIFICATION_PREFERENCES[category];
  }

  const value = prefs.categories[category as keyof typeof prefs.categories];
  return value !== false;
}

function mapNotificationDoc(doc: {
  _id: mongoose.Types.ObjectId;
  type: NotificationType;
  category: NotificationCategory;
  priority: string;
  reminderKind?: string | null;
  title: string;
  body: string;
  deepLink?: string | null;
  entityId?: string | null;
  data?: Record<string, unknown> | null;
  orderId?: mongoose.Types.ObjectId | null;
  serviceId?: mongoose.Types.ObjectId | null;
  receiptNumber?: string | null;
  deadlineAt?: Date | null;
  readAt?: Date | null;
  createdAt: Date;
}): NotificationDto {
  return {
    id: doc._id.toString(),
    type: doc.type,
    category: doc.category,
    priority: doc.priority,
    reminderKind: doc.reminderKind ?? null,
    title: doc.title,
    body: doc.body,
    deepLink: doc.deepLink ?? null,
    entityId: doc.entityId ?? null,
    data: (doc.data as Record<string, unknown>) ?? {},
    orderId: doc.orderId ? doc.orderId.toString() : null,
    serviceId: doc.serviceId ? doc.serviceId.toString() : null,
    receiptNumber: doc.receiptNumber ?? null,
    deadlineAt: doc.deadlineAt ? doc.deadlineAt.toISOString() : null,
    readAt: doc.readAt ? doc.readAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
  };
}

function buildFcmDataPayload(
  notificationId: string,
  template: NotificationTemplateResult,
): Record<string, string> {
  const payload: Record<string, string> = {
    notificationId,
    type: template.type,
    entityId: template.entityId ?? "",
    deepLink: template.deepLink,
    priority: template.priority,
    category: template.category,
  };
  if (template.data) {
    for (const [key, value] of Object.entries(template.data)) {
      payload[key] = value;
    }
  }
  return payload;
}

async function pruneInvalidToken(
  userId: string,
  fcmToken: string,
): Promise<void> {
  await DeviceToken.deleteOne({
    userId: new mongoose.Types.ObjectId(userId),
    fcmToken,
  });
}

async function sendPushToUser(
  userId: string,
  template: NotificationTemplateResult,
  notificationId: string,
): Promise<void> {
  if (!isFcmEnabled()) {
    return;
  }

  const deliver = await shouldDeliver(userId, template.category);
  if (!deliver) {
    logger.info("Notification push skipped by user preferences", {
      userId,
      category: template.category,
    });
    return;
  }

  const messaging = getFirebaseMessaging();
  if (!messaging) {
    return;
  }

  const tokens = await DeviceToken.find({
    userId: new mongoose.Types.ObjectId(userId),
  })
    .select("fcmToken platform")
    .lean();

  if (tokens.length === 0) {
    return;
  }

  const data = buildFcmDataPayload(notificationId, template);
  const highPriority = isHighFcmPriority(template.priority);

  const response = await messaging.sendEachForMulticast({
    tokens: tokens.map((t) => t.fcmToken),
    notification: {
      title: template.title,
      body: template.body,
    },
    data,
    android: {
      priority: highPriority ? "high" : "normal",
    },
    apns: {
      headers: {
        "apns-priority": highPriority ? "10" : "5",
      },
      payload: {
        aps: {
          alert: {
            title: template.title,
            body: template.body,
          },
          sound: "default",
        },
      },
    },
  });

  let successCount = 0;
  let failureCount = 0;

  response.responses.forEach((result: SendResponse, index: number) => {
    if (result.success) {
      successCount += 1;
      return;
    }
    failureCount += 1;
    const token = tokens[index]?.fcmToken;
    const code = result.error?.code ?? "";
    if (token && INVALID_TOKEN_CODES.has(code)) {
      void pruneInvalidToken(userId, token);
      logger.info("Removed invalid FCM token", { userId, code });
    } else {
      logger.warn("FCM delivery failed", {
        userId,
        code,
        message: result.error?.message,
      });
    }
  });

  logger.info("FCM multicast completed", {
    userId,
    successCount,
    failureCount,
    tokenCount: tokens.length,
  });
}

async function persistNotification(
  userId: string,
  template: NotificationTemplateResult,
): Promise<{ id: string; collection: "notification" | "admin" }> {
  if (template.adminInbox) {
    const doc = await AdminNotification.create({
      userId: new mongoose.Types.ObjectId(userId),
      type: template.adminType ?? "concierge_request_received",
      title: template.title,
      body: template.body,
      conciergeRequestId: template.conciergeRequestId
        ? new mongoose.Types.ObjectId(template.conciergeRequestId)
        : undefined,
      priority: template.priority,
      deepLink: template.deepLink,
      entityId: template.entityId,
      data: template.data ?? {},
      category: template.category,
    });
    return { id: doc._id.toString(), collection: "admin" };
  }

  const doc = await Notification.create({
    userId: new mongoose.Types.ObjectId(userId),
    type: template.type,
    category: template.category,
    priority: template.priority,
    title: template.title,
    body: template.body,
    deepLink: template.deepLink,
    entityId: template.entityId,
    data: template.data ?? {},
    orderId: template.orderId
      ? new mongoose.Types.ObjectId(template.orderId)
      : undefined,
    serviceId: template.serviceId
      ? new mongoose.Types.ObjectId(template.serviceId)
      : undefined,
    receiptNumber: template.receiptNumber,
    deadlineAt: template.deadlineAt,
    reminderKind: template.reminderKind,
  });

  return { id: doc._id.toString(), collection: "notification" };
}

export const NotificationService = {
  async send(
    userId: string,
    template: NotificationTemplateResult,
  ): Promise<NotificationDto | null> {
    const user = await User.findById(userId).select("role").lean();
    if (!user) {
      logger.warn("Notification skipped: user not found", { userId });
      return null;
    }

    const { id } = await persistNotification(userId, template);

    try {
      await sendPushToUser(userId, template, id);
    } catch (err) {
      logger.error("FCM push failed after notification saved", {
        userId,
        notificationId: id,
        error: err,
      });
    }

    if (template.adminInbox) {
      return null;
    }

    const doc = await Notification.findById(id).lean();
    if (!doc) {
      return null;
    }
    return mapNotificationDoc(doc as Parameters<typeof mapNotificationDoc>[0]);
  },

  async sendToMany(
    userIds: string[],
    template: NotificationTemplateResult,
  ): Promise<void> {
    for (const userId of userIds) {
      try {
        await NotificationService.send(userId, template);
      } catch (err) {
        logger.error("Failed to send notification to user", { userId, error: err });
      }
    }
  },

  mapNotificationDoc,
};

export type { DevicePlatform };
