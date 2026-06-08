import mongoose from "mongoose";
import { SUPPORTED_CURRENCIES } from "../shared/currency/types";

const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    balance: { type: Number, required: true, default: 0, min: 0 },
    currency: {
      type: String,
      required: true,
      enum: SUPPORTED_CURRENCIES,
      trim: true,
    },
  },
  { timestamps: true },
);

walletSchema.index({ userId: 1, currency: 1 }, { unique: true });

export const Wallet = mongoose.model("Wallet", walletSchema);
