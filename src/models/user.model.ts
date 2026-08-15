import mongoose from "mongoose";
import { normalizeCountryCode } from "../shared/lib/countryCode";

export type UserRole = "client" | "service_provider" | "admin" | "dispatch";

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
      enum: ["client", "service_provider", "admin", "dispatch"],
      required: true,
    },
    emailVerified: { type: Boolean, default: false },
    isSuspended: { type: Boolean, default: false },
    /** Set for clients; null for service providers and legacy users */
    dateOfBirth: { type: Date, default: null },
    /** Marketplace listing IDs the user saved (most recently added first). */
    favoriteServiceIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Service" }],
      default: [],
    },
    /** Owning service_provider user (dispatch role only). */
    ownerProviderUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    /** Ground ambulance listing linked 1:1 (dispatch role only). */
    assignedServiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      default: null,
      unique: true,
      sparse: true,
    },
    /** When true, dispatch login is blocked (e.g. listing marked unavailable). */
    isDisabled: { type: Boolean, default: false },
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
