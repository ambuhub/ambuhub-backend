import mongoose from "mongoose";

const reminderKindValues = ["1d", "1h"] as const;

export const scheduleNotificationTypeValues = [
  "hire_return_reminder",
  "provider_hire_return_reminder",
] as const;

const notificationScheduleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    lineIndex: { type: Number, required: true, min: 0 },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    serviceTitle: { type: String, required: true, trim: true },
    notificationType: {
      type: String,
      enum: scheduleNotificationTypeValues,
      required: true,
    },
    deadlineAt: { type: Date, required: true },
    reminderKind: {
      type: String,
      enum: reminderKindValues,
      required: true,
    },
    fireAt: { type: Date, required: true, index: true },
    sentAt: { type: Date, required: false },
  },
  { timestamps: true },
);

notificationScheduleSchema.index(
  { userId: 1, orderId: 1, lineIndex: 1, reminderKind: 1 },
  { unique: true },
);
notificationScheduleSchema.index({ sentAt: 1, fireAt: 1 });

export type NotificationReminderKind = (typeof reminderKindValues)[number];
export type ScheduleNotificationType =
  (typeof scheduleNotificationTypeValues)[number];

export const NotificationSchedule = mongoose.model(
  "NotificationSchedule",
  notificationScheduleSchema,
);
