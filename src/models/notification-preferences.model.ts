import mongoose from "mongoose";
import {
  notificationCategoryValues,
  type NotificationCategory,
} from "../models/notification.model";

const categoryPreferenceSchema = new mongoose.Schema(
  {
    ambulance_updates: { type: Boolean, default: true },
    booking_updates: { type: Boolean, default: true },
    payments: { type: Boolean, default: true },
    chat_messages: { type: Boolean, default: true },
    concierge: { type: Boolean, default: true },
    marketing: { type: Boolean, default: true },
    general: { type: Boolean, default: true },
  },
  { _id: false },
);

const notificationPreferencesSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    categories: {
      type: categoryPreferenceSchema,
      default: () => ({}),
    },
  },
  { timestamps: true },
);

export const DEFAULT_NOTIFICATION_PREFERENCES: Record<
  NotificationCategory,
  boolean
> = Object.fromEntries(
  notificationCategoryValues.map((c) => [c, true]),
) as Record<NotificationCategory, boolean>;

export const NotificationPreferences = mongoose.model(
  "NotificationPreferences",
  notificationPreferencesSchema,
);
