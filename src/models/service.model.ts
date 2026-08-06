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

const timeRangeSchema = new mongoose.Schema(
  {
    timeStart: { type: String, required: true, trim: true },
    timeEnd: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const hourlyScheduleOverrideSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, trim: true },
    kind: { type: String, required: true, enum: ["closed", "custom"] },
    windows: { type: [timeRangeSchema], default: undefined },
  },
  { _id: false },
);

const hourlyBookingScheduleSchema = new mongoose.Schema(
  {
    default: { type: hireReturnWindowSchema, required: true },
    overrides: { type: [hourlyScheduleOverrideSchema], default: [] },
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
    currency: {
      type: String,
      enum: ["NGN", "GHS"],
      default: "NGN",
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
    hourlyBookingSchedule: { type: hourlyBookingScheduleSchema, default: null },
    bookingGapMinutes: { type: Number, default: null, min: 0 },
    /** When true, listing is on duty for live ambulance dispatch (ground-ambulance only). */
    dispatchEnabled: { type: Boolean, default: false },
    /** Current ambulance GPS for dispatch matching. */
    liveLocation: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        default: undefined,
      },
    },
    liveLocationUpdatedAt: { type: Date, default: null },
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
  if (n !== "NG" && n !== "GH") {
    this.invalidate("countryCode", "Service country must be NG or GH");
  }
});

serviceSchema.pre("save", function () {
  const loc = this.get("liveLocation") as
    | { coordinates?: number[] | null }
    | null
    | undefined;
  if (loc && !hasValidServiceLiveLocation(loc)) {
    this.set("liveLocation", undefined);
    this.markModified("liveLocation");
  }
});

function hasValidServiceLiveLocation(location: {
  coordinates?: number[] | null;
}): boolean {
  const coords = location.coordinates;
  return (
    Array.isArray(coords) &&
    coords.length === 2 &&
    Number.isFinite(coords[0]) &&
    Number.isFinite(coords[1])
  );
}

serviceSchema.index({ userId: 1, createdAt: -1 });
serviceSchema.index({ liveLocation: "2dsphere" });
serviceSchema.index({
  departmentSlug: 1,
  dispatchEnabled: 1,
  isAvailable: 1,
});

export type ServiceDocument =
  mongoose.InferSchemaType<typeof serviceSchema> & mongoose.Document;

export const Service = mongoose.model("Service", serviceSchema, "services");
