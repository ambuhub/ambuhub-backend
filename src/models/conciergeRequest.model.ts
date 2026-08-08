import mongoose from "mongoose";
import { normalizeCountryCode } from "../shared/lib/countryCode";

export type ConciergeRequestStatus = "pending" | "in_progress" | "resolved";

export const conciergeInquiryTypeValues = [
  "transport_booking",
  "event_coverage",
  "equipment_sourcing",
  "other",
] as const;

export type ConciergeInquiryType = (typeof conciergeInquiryTypeValues)[number];

export const CONCIERGE_INQUIRY_TYPE_LABELS: Record<ConciergeInquiryType, string> =
  {
    transport_booking: "Transport booking help",
    event_coverage: "Event medical coverage",
    equipment_sourcing: "Equipment or fleet sourcing",
    other: "Other",
  };

const conciergeRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    phone: { type: String, required: true, trim: true, maxlength: 40 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 320,
    },
    countryCode: { type: String, required: true, trim: true, maxlength: 2 },
    inquiryType: {
      type: String,
      enum: conciergeInquiryTypeValues,
      required: true,
    },
    categorySlug: { type: String, required: true, trim: true, maxlength: 120 },
    categoryName: { type: String, required: true, trim: true, maxlength: 200 },
    departmentSlug: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    departmentName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    status: {
      type: String,
      enum: ["pending", "in_progress", "resolved"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true },
);

conciergeRequestSchema.pre("validate", function () {
  const raw = this.get("countryCode");
  if (typeof raw !== "string" || !raw.trim()) {
    return;
  }
  const normalized = normalizeCountryCode(raw);
  if (!normalized) {
    this.invalidate(
      "countryCode",
      "Invalid ISO 3166-1 alpha-2 country code",
    );
    return;
  }
  this.set("countryCode", normalized);
});

conciergeRequestSchema.index({ createdAt: -1 });

export const ConciergeRequest = mongoose.model(
  "ConciergeRequest",
  conciergeRequestSchema,
);
