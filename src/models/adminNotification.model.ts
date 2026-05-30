import mongoose from "mongoose";

export const adminNotificationTypeValues = ["concierge_request_received"] as const;

const adminNotificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: adminNotificationTypeValues,
      required: true,
    },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    conciergeRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ConciergeRequest",
      required: false,
    },
    readAt: { type: Date, required: false },
  },
  { timestamps: true },
);

adminNotificationSchema.index({ userId: 1, createdAt: -1 });
adminNotificationSchema.index({ userId: 1, readAt: 1 });

export type AdminNotificationType = (typeof adminNotificationTypeValues)[number];

export const AdminNotification = mongoose.model(
  "AdminNotification",
  adminNotificationSchema,
);
