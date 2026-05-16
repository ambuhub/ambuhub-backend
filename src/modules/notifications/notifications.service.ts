import mongoose from "mongoose";
import {
  Notification,
  type NotificationType,
} from "../../models/notification.model";
import {
  NotificationSchedule,
  type NotificationReminderKind,
  type ScheduleNotificationType,
} from "../../models/notification-schedule.model";
import { User } from "../../models/user.model";
import { logger } from "../../shared/lib/logger";

const LAGOS_TZ = "Africa/Lagos";
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

export type NotificationDto = {
  id: string;
  type: NotificationType;
  reminderKind: NotificationReminderKind | null;
  title: string;
  body: string;
  orderId: string;
  serviceId: string;
  receiptNumber: string | null;
  deadlineAt: string | null;
  readAt: string | null;
  createdAt: string;
};

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

export function formatDeadlineWat(deadline: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: LAGOS_TZ,
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(deadline);
}

function buildScheduledNotificationCopy(
  notificationType: ScheduleNotificationType,
  serviceTitle: string,
  reminderKind: NotificationReminderKind,
  deadlineAt: Date,
): { title: string; body: string; type: NotificationType } {
  const when = formatDeadlineWat(deadlineAt);

  if (notificationType === "provider_hire_return_reminder") {
    if (reminderKind === "1d") {
      return {
        type: "provider_hire_return_reminder",
        title: "Hire return in 24 hours",
        body: `A customer should return "${serviceTitle}" in about 24 hours (${when} WAT). Check Bookings for details.`,
      };
    }
    return {
      type: "provider_hire_return_reminder",
      title: "Hire return in 1 hour",
      body: `A customer should return "${serviceTitle}" in about 1 hour (${when} WAT).`,
    };
  }

  if (reminderKind === "1d") {
    return {
      type: "hire_return_reminder",
      title: "Hire return due in 24 hours",
      body: `Your hire return for "${serviceTitle}" is due in about 24 hours (${when} WAT). View your receipt for details.`,
    };
  }
  return {
    type: "hire_return_reminder",
    title: "Hire return due in 1 hour",
    body: `Your hire return for "${serviceTitle}" is due in about 1 hour (${when} WAT). Please return the item on time.`,
  };
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

function mapNotification(doc: {
  _id: mongoose.Types.ObjectId;
  type: NotificationType;
  reminderKind?: NotificationReminderKind | null;
  title: string;
  body: string;
  orderId: mongoose.Types.ObjectId;
  serviceId: mongoose.Types.ObjectId;
  receiptNumber?: string | null;
  deadlineAt?: Date | null;
  readAt?: Date | null;
  createdAt: Date;
}): NotificationDto {
  return {
    id: doc._id.toString(),
    type: doc.type,
    reminderKind: doc.reminderKind ?? null,
    title: doc.title,
    body: doc.body,
    orderId: doc.orderId.toString(),
    serviceId: doc.serviceId.toString(),
    receiptNumber: doc.receiptNumber ?? null,
    deadlineAt: doc.deadlineAt ? doc.deadlineAt.toISOString() : null,
    readAt: doc.readAt ? doc.readAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
  };
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

  for (const line of input.lines) {
    if (!line.sellerUserId) {
      continue;
    }
    if (line.sellerUserId.equals(buyerOid)) {
      continue;
    }

    const book = isBookLine(line);
    const hire = !book && isHireLine(line);
    const title = book ? "New booking" : hire ? "New hire booking" : "New sale";
    let body: string;
    let notificationType: NotificationType;
    let deadlineAt: Date | undefined;
    if (book && line.bookEnd) {
      const when = formatDeadlineWat(line.bookEnd);
      body = `Your listing "${line.title}" was booked (receipt ${input.receiptNumber}). Session ends ${when} WAT.`;
      notificationType = "provider_booking_confirmed";
      deadlineAt = line.bookEnd;
    } else if (hire && line.hireEnd) {
      const when = formatDeadlineWat(line.hireEnd);
      body = `Your listing "${line.title}" was hired (receipt ${input.receiptNumber}). Return due ${when} WAT.`;
      notificationType = "provider_hire_booked";
      deadlineAt = line.hireEnd;
    } else {
      body = `Someone purchased "${line.title}" (receipt ${input.receiptNumber}).`;
      notificationType = "provider_sale_purchased";
    }

    try {
      await Notification.create({
        userId: line.sellerUserId,
        type: notificationType,
        title,
        body,
        orderId: input.orderId,
        serviceId: line.serviceId,
        receiptNumber: input.receiptNumber,
        ...(deadlineAt ? { deadlineAt } : {}),
      });
    } catch (err) {
      logger.error("Failed to create provider order notification", {
        orderId: input.orderId.toString(),
        sellerUserId: line.sellerUserId.toString(),
        error: err,
      });
    }
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
        const copy = buildScheduledNotificationCopy(
          notificationType,
          row.serviceTitle,
          row.reminderKind as NotificationReminderKind,
          row.deadlineAt,
        );
        await Notification.create({
          userId: row.userId,
          type: copy.type,
          reminderKind: row.reminderKind,
          title: copy.title,
          body: copy.body,
          orderId: row.orderId,
          serviceId: row.serviceId,
          deadlineAt: row.deadlineAt,
        });
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

export async function listMyNotifications(
  userId: string,
  options: { unreadOnly?: boolean; limit?: number },
): Promise<NotificationDto[]> {
  await assertNotificationUser(userId);
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const filter: Record<string, unknown> = {
    userId: new mongoose.Types.ObjectId(userId),
  };
  if (options.unreadOnly) {
    filter.readAt = { $exists: false };
  }

  const rows = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return rows.map((r) =>
    mapNotification(r as Parameters<typeof mapNotification>[0]),
  );
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

  return mapNotification(doc as Parameters<typeof mapNotification>[0]);
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
