import mongoose from "mongoose";

const pricingPeriodValues = ["hourly", "daily", "weekly", "monthly", "yearly"] as const;
const lineKindValues = ["sale", "hire", "book"] as const;

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
    sellerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    lineKind: {
      type: String,
      enum: lineKindValues,
      required: false,
    },
    title: { type: String, required: true },
    unitPriceNgn: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    lineTotalNgn: { type: Number, required: true, min: 0 },
    categoryName: { type: String, required: true },
    departmentName: { type: String, required: true },
    hireStart: { type: Date, required: false },
    hireEnd: { type: Date, required: false },
    pricingPeriod: {
      type: String,
      enum: [...pricingPeriodValues],
      required: false,
    },
    hireBillableUnits: { type: Number, required: false, min: 1 },
    bookStart: { type: Date, required: false },
    bookEnd: { type: Date, required: false },
    bookBillableUnits: { type: Number, required: false, min: 1 },
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
