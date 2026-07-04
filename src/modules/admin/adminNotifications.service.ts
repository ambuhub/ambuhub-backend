import mongoose from "mongoose";
import {
  AdminNotification,
  type AdminNotificationType,
} from "../../models/adminNotification.model";
import { User } from "../../models/user.model";
import { logger } from "../../shared/lib/logger";
import { NotificationService } from "../notifications/notification.service";
import { NotificationTemplates } from "../notifications/notification-templates";

export class AdminNotificationsHttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AdminNotificationsHttpError";
  }
}

export type AdminNotificationDto = {
  id: string;
  type: AdminNotificationType;
  category: string | null;
  priority: string | null;
  title: string;
  body: string;
  deepLink: string | null;
  entityId: string | null;
  data: Record<string, unknown>;
  conciergeRequestId: string | null;
  readAt: string | null;
  createdAt: string;
};

function mapAdminNotification(doc: {
  _id: mongoose.Types.ObjectId;
  type: AdminNotificationType;
  category?: string | null;
  priority?: string | null;
  title: string;
  body: string;
  deepLink?: string | null;
  entityId?: string | null;
  data?: Record<string, unknown> | null;
  conciergeRequestId?: mongoose.Types.ObjectId | null;
  readAt?: Date | null;
  createdAt: Date;
}): AdminNotificationDto {
  return {
    id: doc._id.toString(),
    type: doc.type,
    category: doc.category ?? null,
    priority: doc.priority ?? null,
    title: doc.title,
    body: doc.body,
    deepLink: doc.deepLink ?? null,
    entityId: doc.entityId ?? null,
    data: (doc.data as Record<string, unknown>) ?? {},
    conciergeRequestId: doc.conciergeRequestId
      ? doc.conciergeRequestId.toString()
      : null,
    readAt: doc.readAt ? doc.readAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
  };
}

async function assertAdminUser(userId: string): Promise<void> {
  const user = await User.findById(userId).select("role").lean();
  if (!user) {
    throw new AdminNotificationsHttpError(401, "Unauthorized");
  }
  if (user.role !== "admin") {
    throw new AdminNotificationsHttpError(403, "Admin access required");
  }
}

export async function notifyAdminsOfConciergeRequest(input: {
  id: string;
  name: string;
  categoryName: string;
  departmentName: string;
}): Promise<void> {
  const admins = await User.find({ role: "admin" }).select("_id").lean();
  if (admins.length === 0) {
    return;
  }

  const template = NotificationTemplates.conciergeRequestReceived({
    requestId: input.id,
    name: input.name,
    categoryName: input.categoryName,
    departmentName: input.departmentName,
  });

  for (const admin of admins) {
    try {
      await NotificationService.send(admin._id.toString(), template);
    } catch (err) {
      logger.error("Failed to create admin concierge notification", {
        requestId: input.id,
        adminUserId: admin._id.toString(),
        error: err,
      });
    }
  }
}

export type AdminNotificationListResult = {
  notifications: AdminNotificationDto[];
  nextCursor: string | null;
};

export async function listAdminNotifications(
  adminUserId: string,
  options: { unreadOnly?: boolean; limit?: number; cursor?: string },
): Promise<AdminNotificationListResult> {
  await assertAdminUser(adminUserId);
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const filter: Record<string, unknown> = {
    userId: new mongoose.Types.ObjectId(adminUserId),
  };
  if (options.unreadOnly) {
    filter.readAt = { $exists: false };
  }
  if (options.cursor) {
    const cursorDate = new Date(options.cursor);
    if (Number.isNaN(cursorDate.getTime())) {
      throw new AdminNotificationsHttpError(400, "cursor must be a valid ISO8601 date");
    }
    filter.createdAt = { $lt: cursorDate };
  }

  const rows = await AdminNotification.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const notifications = rows.map((row) =>
    mapAdminNotification(row as Parameters<typeof mapAdminNotification>[0]),
  );

  const nextCursor =
    notifications.length === limit
      ? notifications[notifications.length - 1]?.createdAt ?? null
      : null;

  return { notifications, nextCursor };
}

export async function getAdminUnreadNotificationCount(
  adminUserId: string,
): Promise<number> {
  await assertAdminUser(adminUserId);
  return AdminNotification.countDocuments({
    userId: new mongoose.Types.ObjectId(adminUserId),
    readAt: { $exists: false },
  });
}

export async function markAdminNotificationRead(
  adminUserId: string,
  notificationId: string,
): Promise<AdminNotificationDto> {
  await assertAdminUser(adminUserId);
  const trimmed = notificationId?.trim() ?? "";
  if (!trimmed || !mongoose.Types.ObjectId.isValid(trimmed)) {
    throw new AdminNotificationsHttpError(
      400,
      "notificationId must be a valid ObjectId",
    );
  }

  const doc = await AdminNotification.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(trimmed),
      userId: new mongoose.Types.ObjectId(adminUserId),
    },
    { $set: { readAt: new Date() } },
    { new: true },
  ).lean();

  if (!doc) {
    throw new AdminNotificationsHttpError(404, "Notification not found");
  }

  return mapAdminNotification(doc as Parameters<typeof mapAdminNotification>[0]);
}

export async function markAllAdminNotificationsRead(
  adminUserId: string,
): Promise<number> {
  await assertAdminUser(adminUserId);
  const result = await AdminNotification.updateMany(
    {
      userId: new mongoose.Types.ObjectId(adminUserId),
      readAt: { $exists: false },
    },
    { $set: { readAt: new Date() } },
  );
  return result.modifiedCount;
}
