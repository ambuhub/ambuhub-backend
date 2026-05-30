import mongoose from "mongoose";
import {
  AdminNotification,
  type AdminNotificationType,
} from "../../models/adminNotification.model";
import { User } from "../../models/user.model";
import { logger } from "../../shared/lib/logger";

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
  title: string;
  body: string;
  conciergeRequestId: string | null;
  readAt: string | null;
  createdAt: string;
};

function mapAdminNotification(doc: {
  _id: mongoose.Types.ObjectId;
  type: AdminNotificationType;
  title: string;
  body: string;
  conciergeRequestId?: mongoose.Types.ObjectId | null;
  readAt?: Date | null;
  createdAt: Date;
}): AdminNotificationDto {
  return {
    id: doc._id.toString(),
    type: doc.type,
    title: doc.title,
    body: doc.body,
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

  const title = "New concierge request";
  const body = `${input.name} submitted a request for ${input.categoryName} · ${input.departmentName}.`;
  const requestOid = new mongoose.Types.ObjectId(input.id);

  try {
    await AdminNotification.insertMany(
      admins.map((admin) => ({
        userId: admin._id,
        type: "concierge_request_received" as const,
        title,
        body,
        conciergeRequestId: requestOid,
      })),
    );
  } catch (err) {
    logger.error("Failed to create admin concierge notifications", {
      requestId: input.id,
      error: err,
    });
  }
}

export async function listAdminNotifications(
  adminUserId: string,
  options: { unreadOnly?: boolean; limit?: number },
): Promise<AdminNotificationDto[]> {
  await assertAdminUser(adminUserId);
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const filter: Record<string, unknown> = {
    userId: new mongoose.Types.ObjectId(adminUserId),
  };
  if (options.unreadOnly) {
    filter.readAt = { $exists: false };
  }

  const rows = await AdminNotification.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return rows.map((row) =>
    mapAdminNotification(row as Parameters<typeof mapAdminNotification>[0]),
  );
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
