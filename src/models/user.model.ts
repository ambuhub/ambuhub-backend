import mongoose from "mongoose";

export type UserRole = "client" | "service_provider";

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["client", "service_provider"],
      required: true,
    },
    emailVerified: { type: Boolean, default: false },
    /** Set for clients; null for service providers and legacy users */
    dateOfBirth: { type: Date, default: null },
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
