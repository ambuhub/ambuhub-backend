import mongoose from "mongoose";

export const notificationTypeValues = [
  "hire_return_reminder",
  "provider_sale_purchased",
  "provider_hire_booked",
  "provider_hire_return_reminder",
  "provider_booking_confirmed",
  "ambulance_request",
  "request_accepted",
  "request_rejected",
  "ambulance_en_route",
  "ambulance_arrived",
  "booking_confirmed",
  "booking_cancelled",
  "payment_success",
  "payment_failed",
  "chat_message",
  "order_shipped",
  "order_delivered",
  "general",
] as const;

export const notificationCategoryValues = [
  "ambulance_updates",
  "booking_updates",
  "payments",
  "chat_messages",
  "concierge",
  "marketing",
  "general",
] as const;

export const notificationPriorityValues = [
  "critical",
  "high",
  "normal",
  "low",
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
    category: {
      type: String,
      enum: notificationCategoryValues,
      required: true,
    },
    priority: {
      type: String,
      enum: notificationPriorityValues,
      required: true,
      default: "normal",
    },
    reminderKind: {
      type: String,
      enum: reminderKindValues,
      required: false,
    },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    deepLink: { type: String, required: false, trim: true },
    entityId: { type: String, required: false, trim: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: false,
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: false,
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
export type NotificationCategory = (typeof notificationCategoryValues)[number];
export type NotificationPriority = (typeof notificationPriorityValues)[number];
export type NotificationReminderKind = (typeof reminderKindValues)[number];

export const Notification = mongoose.model("Notification", notificationSchema);
