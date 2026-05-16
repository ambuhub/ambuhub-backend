import mongoose from "mongoose";
import { normalizeCountryCode } from "../shared/lib/countryCode";

const listingTypeValues = ["sale", "hire", "book"] as const;
const pricingPeriodValues = [
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly",
] as const;

const hireReturnWindowSchema = new mongoose.Schema(
  {
    daysOfWeek: { type: [Number], required: true },
    timeStart: { type: String, required: true, trim: true },
    timeEnd: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const serviceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    serviceCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceCategory",
      required: true,
      index: true,
    },
    listingType: {
      type: String,
      enum: listingTypeValues,
      default: null,
    },
    stock: {
      type: Number,
      default: null,
      min: 0,
    },
    price: {
      type: Number,
      default: null,
      min: 0,
    },
    pricingPeriod: {
      type: String,
      enum: [...pricingPeriodValues],
      default: null,
    },
    departmentSlug: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    photoUrls: { type: [String], default: [] },
    isAvailable: { type: Boolean, default: true },
    /** ISO 3166-1 alpha-2, uppercase (e.g. NG, US) */
    countryCode: { type: String, trim: true, uppercase: true, maxlength: 2, default: null },
    /** State/province isoCode from country-state-city, or manual text when country has no subdivisions */
    stateProvince: { type: String, trim: true, default: null },
    officeAddress: { type: String, trim: true, default: null },
    hireReturnWindow: { type: hireReturnWindowSchema, default: null },
    bookingWindow: { type: hireReturnWindowSchema, default: null },
    bookingGapMinutes: { type: Number, default: null, min: 0 },
  },
  { timestamps: true }
);

serviceSchema.pre("validate", function () {
  const raw = this.get("countryCode");
  if (raw === null || raw === undefined) {
    return;
  }
  if (typeof raw !== "string" || !raw.trim()) {
    return;
  }
  const n = normalizeCountryCode(raw);
  if (!n) {
    this.invalidate("countryCode", "Invalid ISO 3166-1 alpha-2 country code");
    return;
  }
  this.set("countryCode", n);
});

serviceSchema.index({ userId: 1, createdAt: -1 });

export type ServiceDocument =
  mongoose.InferSchemaType<typeof serviceSchema> & mongoose.Document;

export const Service = mongoose.model("Service", serviceSchema, "services");
