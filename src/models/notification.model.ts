import mongoose from "mongoose";

export const notificationTypeValues = [
  "hire_return_reminder",
  "provider_sale_purchased",
  "provider_hire_booked",
  "provider_hire_return_reminder",
  "provider_booking_confirmed",
] as const;

const reminderKindValues = ["1d", "1h"] as const;

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: notificationTypeValues,
      required: true,
    },
    reminderKind: {
      type: String,
      enum: reminderKindValues,
      required: false,
    },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    receiptNumber: { type: String, required: false, trim: true },
    deadlineAt: { type: Date, required: false },
    readAt: { type: Date, required: false },
  },
  { timestamps: true },
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, readAt: 1 });

export type NotificationType = (typeof notificationTypeValues)[number];
export type NotificationReminderKind = (typeof reminderKindValues)[number];

export const Notification = mongoose.model("Notification", notificationSchema);
