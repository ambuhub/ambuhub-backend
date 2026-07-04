import mongoose from "mongoose";
import {
  Notification,
  type NotificationCategory,
  type NotificationPriority,
  type NotificationReminderKind,
  type NotificationType,
} from "../../models/notification.model";
import {
  NotificationSchedule,
  type ScheduleNotificationType,
} from "../../models/notification-schedule.model";
import { User } from "../../models/user.model";
import { logger } from "../../shared/lib/logger";
import {
  categoryForType,
  priorityForType,
} from "./notification-categories";
import { formatDeadlineWat } from "./notification-format";
import {
  NotificationService,
  type NotificationDto,
} from "./notification.service";
import { NotificationTemplates } from "./notification-templates";

export { formatDeadlineWat } from "./notification-format";
export type { NotificationDto } from "./notification.service";

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const WORKER_BATCH_LIMIT = 200;

export class NotificationsHttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "NotificationsHttpError";
  }
}

export type OrderLineForNotifications = {
  lineKind?: "sale" | "hire" | "book";
  serviceId: mongoose.Types.ObjectId;
  sellerUserId?: mongoose.Types.ObjectId;
  title: string;
  hireEnd?: Date;
  bookEnd?: Date;
};

type HireLineForSchedule = {
  lineKind?: "sale" | "hire";
  serviceId: mongoose.Types.ObjectId;
  title: string;
  hireEnd?: Date;
};

function isHireLine(line: OrderLineForNotifications): boolean {
  return line.lineKind === "hire" || (line.hireEnd != null && line.lineKind !== "book");
}

function isBookLine(line: OrderLineForNotifications): boolean {
  return line.lineKind === "book" || line.bookEnd != null;
}

function mapLegacyNotification(doc: {
  _id: mongoose.Types.ObjectId;
  type: NotificationType;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  reminderKind?: NotificationReminderKind | null;
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
  return NotificationService.mapNotificationDoc({
    ...doc,
    category: doc.category ?? categoryForType(doc.type),
    priority: doc.priority ?? priorityForType(doc.type),
  });
}

async function assertNotificationUser(userId: string): Promise<void> {
  const user = await User.findById(userId).select("role").lean();
  if (!user) {
    throw new NotificationsHttpError(401, "Unauthorized");
  }
  if (user.role !== "client" && user.role !== "service_provider") {
    throw new NotificationsHttpError(
      403,
      "Only client and provider accounts can access notifications",
    );
  }
}

export async function scheduleHireReturnReminders(input: {
  userId: string;
  orderId: mongoose.Types.ObjectId;
  lines: HireLineForSchedule[];
  notificationType?: ScheduleNotificationType;
}): Promise<void> {
  const notificationType =
    input.notificationType ?? "hire_return_reminder";
  const now = new Date();
  const userOid = new mongoose.Types.ObjectId(input.userId);
  const docs: {
    userId: mongoose.Types.ObjectId;
    orderId: mongoose.Types.ObjectId;
    lineIndex: number;
    serviceId: mongoose.Types.ObjectId;
    serviceTitle: string;
    notificationType: ScheduleNotificationType;
    deadlineAt: Date;
    reminderKind: NotificationReminderKind;
    fireAt: Date;
  }[] = [];

  input.lines.forEach((line, lineIndex) => {
    if (line.lineKind === "sale" || !line.hireEnd) {
      return;
    }
    const deadlineAt = line.hireEnd;
    const kinds: { kind: NotificationReminderKind; offsetMs: number }[] = [
      { kind: "1d", offsetMs: MS_PER_DAY },
      { kind: "1h", offsetMs: MS_PER_HOUR },
    ];
    for (const { kind, offsetMs } of kinds) {
      const fireAt = new Date(deadlineAt.getTime() - offsetMs);
      if (fireAt <= now) {
        continue;
      }
      docs.push({
        userId: userOid,
        orderId: input.orderId,
        lineIndex,
        serviceId: line.serviceId,
        serviceTitle: line.title,
        notificationType,
        deadlineAt,
        reminderKind: kind,
        fireAt,
      });
    }
  });

  if (docs.length === 0) {
    return;
  }

  try {
    await NotificationSchedule.insertMany(docs, { ordered: false });
  } catch (err: unknown) {
    const bulkErr = err as { code?: number };
    if (bulkErr.code === 11000) {
      return;
    }
    throw err;
  }
}

export async function scheduleProviderHireReturnReminders(input: {
  sellerUserId: string;
  orderId: mongoose.Types.ObjectId;
  lines: HireLineForSchedule[];
}): Promise<void> {
  await scheduleHireReturnReminders({
    userId: input.sellerUserId,
    orderId: input.orderId,
    lines: input.lines,
    notificationType: "provider_hire_return_reminder",
  });
}

export async function notifyProvidersOnOrderPaid(input: {
  buyerUserId: string;
  orderId: mongoose.Types.ObjectId;
  receiptNumber: string;
  lines: OrderLineForNotifications[];
}): Promise<void> {
  const buyerOid = new mongoose.Types.ObjectId(input.buyerUserId);
  const orderId = input.orderId.toString();

  for (const line of input.lines) {
    if (!line.sellerUserId) {
      continue;
    }
    if (line.sellerUserId.equals(buyerOid)) {
      continue;
    }

    const book = isBookLine(line);
    const hire = !book && isHireLine(line);
    const serviceId = line.serviceId.toString();
    const sellerId = line.sellerUserId.toString();

    try {
      if (book) {
        await NotificationService.send(
          sellerId,
          NotificationTemplates.bookingConfirmed({
            orderId,
            serviceId,
            serviceTitle: line.title,
            receiptNumber: input.receiptNumber,
            role: "provider",
            bookEnd: line.bookEnd,
          }),
        );
      } else if (hire) {
        await NotificationService.send(
          sellerId,
          NotificationTemplates.providerHireBooked({
            orderId,
            serviceId,
            serviceTitle: line.title,
            receiptNumber: input.receiptNumber,
            hireEnd: line.hireEnd,
          }),
        );
      } else {
        await NotificationService.send(
          sellerId,
          NotificationTemplates.providerSalePurchased({
            orderId,
            serviceId,
            serviceTitle: line.title,
            receiptNumber: input.receiptNumber,
          }),
        );
      }
    } catch (err) {
      logger.error("Failed to create provider order notification", {
        orderId,
        sellerUserId: sellerId,
        error: err,
      });
    }
  }

  try {
    await NotificationService.send(
      input.buyerUserId,
      NotificationTemplates.paymentSuccess({
        orderId,
        receiptNumber: input.receiptNumber,
        role: "client",
      }),
    );
  } catch (err) {
    logger.error("Failed to create buyer payment notification", {
      orderId,
      buyerUserId: input.buyerUserId,
      error: err,
    });
  }
}

export async function processDueNotificationSchedules(): Promise<void> {
  const now = new Date();
  const due = await NotificationSchedule.find({
    sentAt: null,
    fireAt: { $lte: now },
  })
    .sort({ fireAt: 1 })
    .limit(WORKER_BATCH_LIMIT)
    .lean();

  for (const row of due) {
    const scheduleId = row._id as mongoose.Types.ObjectId;
    try {
      if (row.deadlineAt > now) {
        const notificationType = (row.notificationType ??
          "hire_return_reminder") as ScheduleNotificationType;
        const role =
          notificationType === "provider_hire_return_reminder"
            ? "provider"
            : "client";

        await NotificationService.send(
          row.userId.toString(),
          NotificationTemplates.hireReturnReminder({
            orderId: row.orderId.toString(),
            serviceId: row.serviceId.toString(),
            serviceTitle: row.serviceTitle,
            deadlineAt: row.deadlineAt,
            reminderKind: row.reminderKind as NotificationReminderKind,
            role,
          }),
        );
      }
      await NotificationSchedule.updateOne(
        { _id: scheduleId },
        { $set: { sentAt: now } },
      );
    } catch (err) {
      logger.error("Failed to process notification schedule", {
        scheduleId: scheduleId.toString(),
        error: err,
      });
    }
  }
}

export type NotificationListResult = {
  notifications: NotificationDto[];
  nextCursor: string | null;
};

export async function listMyNotifications(
  userId: string,
  options: { unreadOnly?: boolean; limit?: number; cursor?: string },
): Promise<NotificationListResult> {
  await assertNotificationUser(userId);
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const filter: Record<string, unknown> = {
    userId: new mongoose.Types.ObjectId(userId),
  };
  if (options.unreadOnly) {
    filter.readAt = { $exists: false };
  }
  if (options.cursor) {
    const cursorDate = new Date(options.cursor);
    if (Number.isNaN(cursorDate.getTime())) {
      throw new NotificationsHttpError(400, "cursor must be a valid ISO8601 date");
    }
    filter.createdAt = { $lt: cursorDate };
  }

  const rows = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const notifications = rows.map((r) =>
    mapLegacyNotification(r as Parameters<typeof mapLegacyNotification>[0]),
  );

  const nextCursor =
    notifications.length === limit
      ? notifications[notifications.length - 1]?.createdAt ?? null
      : null;

  return { notifications, nextCursor };
}

export async function getUnreadNotificationCount(
  userId: string,
): Promise<number> {
  await assertNotificationUser(userId);
  return Notification.countDocuments({
    userId: new mongoose.Types.ObjectId(userId),
    readAt: { $exists: false },
  });
}

export async function markNotificationRead(
  userId: string,
  notificationId: string,
): Promise<NotificationDto> {
  await assertNotificationUser(userId);
  const trimmed = notificationId?.trim() ?? "";
  if (!trimmed || !mongoose.Types.ObjectId.isValid(trimmed)) {
    throw new NotificationsHttpError(400, "notificationId must be a valid ObjectId");
  }

  const doc = await Notification.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(trimmed),
      userId: new mongoose.Types.ObjectId(userId),
    },
    { $set: { readAt: new Date() } },
    { new: true },
  ).lean();

  if (!doc) {
    throw new NotificationsHttpError(404, "Notification not found");
  }

  return mapLegacyNotification(doc as Parameters<typeof mapLegacyNotification>[0]);
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  await assertNotificationUser(userId);
  const result = await Notification.updateMany(
    {
      userId: new mongoose.Types.ObjectId(userId),
      readAt: { $exists: false },
    },
    { $set: { readAt: new Date() } },
  );
  return result.modifiedCount;
}
