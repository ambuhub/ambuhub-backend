import mongoose from "mongoose";

export const otpPurposeValues = [
  "verify_email",
  "reset_password",
  "change_email",
] as const;
export type OtpPurpose = (typeof otpPurposeValues)[number];

const otpSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 320,
    },
    purpose: {
      type: String,
      enum: otpPurposeValues,
      required: true,
      index: true,
    },
    codeHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true, index: true },
    sentAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    consumedAt: { type: Date, required: false, default: null },
  },
  { timestamps: true },
);

otpSchema.index({ userId: 1, purpose: 1, createdAt: -1 });
otpSchema.index({ email: 1, purpose: 1, createdAt: -1 });

export const Otp = mongoose.model("Otp", otpSchema);
