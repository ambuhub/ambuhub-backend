import mongoose from "mongoose";

const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    balanceNgn: { type: Number, required: true, default: 0, min: 0 },
    currency: { type: String, required: true, default: "NGN", trim: true },
  },
  { timestamps: true },
);

export const Wallet = mongoose.model("Wallet", walletSchema);
