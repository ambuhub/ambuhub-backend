import mongoose from "mongoose";

export const devicePlatformValues = ["web", "android", "ios"] as const;

const deviceTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    fcmToken: { type: String, required: true, trim: true },
    platform: {
      type: String,
      enum: devicePlatformValues,
      required: true,
    },
    deviceName: { type: String, required: false, trim: true },
    appVersion: { type: String, required: false, trim: true },
    lastSeenAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
);

deviceTokenSchema.index({ userId: 1, fcmToken: 1 }, { unique: true });
deviceTokenSchema.index({ userId: 1, lastSeenAt: -1 });

export type DevicePlatform = (typeof devicePlatformValues)[number];

export const DeviceToken = mongoose.model("DeviceToken", deviceTokenSchema);
