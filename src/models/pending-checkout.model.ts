import mongoose from "mongoose";

const checkoutKindValues = ["sale", "hire", "book"] as const;
const pendingStatusValues = ["pending", "completed", "cancelled", "expired"] as const;

const pendingCheckoutSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: checkoutKindValues,
      required: true,
    },
    reference: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    amountSubunits: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true },
    status: {
      type: String,
      enum: pendingStatusValues,
      required: true,
      default: "pending",
    },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true },
);

pendingCheckoutSchema.index({ userId: 1, status: 1, createdAt: -1 });

export const PendingCheckout = mongoose.model(
  "PendingCheckout",
  pendingCheckoutSchema,
);

export type PendingCheckoutKind = (typeof checkoutKindValues)[number];
