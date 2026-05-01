import mongoose from "mongoose";
import { normalizeCountryCode } from "../shared/lib/countryCode";

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
    /** ISO 3166-1 alpha-2, uppercase (e.g. US, NG) */
    countryCode: { type: String, required: true, trim: true, maxlength: 2 },
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

userSchema.pre("validate", function () {
  const raw = this.get("countryCode");
  if (typeof raw !== "string" || !raw.trim()) {
    return;
  }
  const n = normalizeCountryCode(raw);
  if (!n) {
    this.invalidate(
      "countryCode",
      "Invalid ISO 3166-1 alpha-2 country code",
    );
    return;
  }
  this.set("countryCode", n);
});

export const User = mongoose.model("User", userSchema);
