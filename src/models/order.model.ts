import mongoose from "mongoose";

const orderLineSchema = new mongoose.Schema(
  {
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    /** Listing owner at checkout; used for reporting when the service row is deleted. */
    sellerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    title: { type: String, required: true },
    unitPriceNgn: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    lineTotalNgn: { type: Number, required: true, min: 0 },
    categoryName: { type: String, required: true },
    categorySlug: { type: String, required: true },
    departmentName: { type: String, required: true },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    receiptNumber: { type: String, required: true, unique: true, index: true },
    currency: { type: String, required: true, default: "NGN" },
    subtotalNgn: { type: Number, required: true, min: 0 },
    lines: { type: [orderLineSchema], required: true },
    paymentProvider: {
      type: String,
      required: true,
      enum: ["paystack_simulated"],
    },
    paystackReference: { type: String, required: true },
    paystackSimulated: { type: Boolean, required: true, default: true },
    paidAt: { type: Date, required: true },
  },
  { timestamps: true },
);

orderSchema.index({ userId: 1, createdAt: -1 });

export const Order = mongoose.model("Order", orderSchema);
