import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    sellerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    lineKind: {
      type: String,
      enum: ["sale", "hire"],
      required: false,
    },
    /** Snapshot for display if listing is renamed or removed from marketplace */
    serviceTitle: { type: String, required: true, trim: true },
    categorySlug: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    reviewerFirstName: { type: String, required: true, trim: true },
    reviewerLastName: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

reviewSchema.index({ userId: 1, orderId: 1, serviceId: 1 }, { unique: true });
reviewSchema.index({ serviceId: 1, createdAt: -1 });

export const Review = mongoose.model("Review", reviewSchema);
