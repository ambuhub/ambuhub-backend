import mongoose from "mongoose";

/**
 * Immutable receipt snapshot tied to a paid order.
 * Kept separate from {@link Order} so receipts can be extended (PDF URL, email sent, etc.)
 * without growing the orders collection query patterns.
 */
const receiptLineSchema = new mongoose.Schema(
  {
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    title: { type: String, required: true },
    unitPriceNgn: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    lineTotalNgn: { type: Number, required: true, min: 0 },
    categoryName: { type: String, required: true },
    departmentName: { type: String, required: true },
  },
  { _id: false },
);

const receiptSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    receiptNumber: { type: String, required: true, unique: true, index: true },
    currency: { type: String, required: true, default: "NGN" },
    subtotalNgn: { type: Number, required: true, min: 0 },
    lines: { type: [receiptLineSchema], required: true },
    paymentProvider: { type: String, required: true },
    paystackReference: { type: String, required: true },
    issuedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

receiptSchema.index({ userId: 1, issuedAt: -1 });

export const Receipt = mongoose.model("Receipt", receiptSchema);
