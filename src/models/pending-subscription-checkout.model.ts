import mongoose from "mongoose";

const pendingStatusValues = ["pending", "completed", "cancelled", "expired"] as const;
const subscriptionIntervalValues = ["monthly", "yearly"] as const;

const pendingSubscriptionCheckoutSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reference: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    interval: {
      type: String,
      enum: subscriptionIntervalValues,
      required: true,
    },
    amountSubunits: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true },
    status: {
      type: String,
      enum: pendingStatusValues,
      required: true,
      default: "pending",
    },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true },
);

pendingSubscriptionCheckoutSchema.index({ userId: 1, status: 1, createdAt: -1 });

export const PendingSubscriptionCheckout = mongoose.model(
  "PendingSubscriptionCheckout",
  pendingSubscriptionCheckoutSchema,
);

export type SubscriptionInterval = (typeof subscriptionIntervalValues)[number];
