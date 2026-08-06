import mongoose from "mongoose";

export const dispatchStatusValues = [
  "searching",
  "offered",
  "accepted",
  "en_route",
  "arrived",
  "cancelled",
  "expired",
  "no_provider",
] as const;

export const dispatchLocationSourceValues = [
  "current_location",
  "address",
] as const;

export const dispatchAttemptOutcomeValues = [
  "pending",
  "accepted",
  "rejected",
  "timeout",
] as const;

const geoPointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point", required: true },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator(v: number[]) {
          return (
            Array.isArray(v) &&
            v.length === 2 &&
            typeof v[0] === "number" &&
            typeof v[1] === "number"
          );
        },
        message: "coordinates must be [longitude, latitude]",
      },
    },
  },
  { _id: false },
);

const dispatchAttemptSchema = new mongoose.Schema(
  {
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    providerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    offeredAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    outcome: {
      type: String,
      enum: dispatchAttemptOutcomeValues,
      default: "pending",
    },
    distanceMeters: { type: Number, default: null },
  },
  { _id: false },
);

const ambulanceDispatchRequestSchema = new mongoose.Schema(
  {
    clientUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: dispatchStatusValues,
      required: true,
      default: "searching",
    },
    locationSource: {
      type: String,
      enum: dispatchLocationSourceValues,
      required: true,
    },
    pickupAddress: { type: String, trim: true, default: null },
    pickupLocation: { type: geoPointSchema, required: true },
    clientNotes: { type: String, trim: true, default: null, maxlength: 1000 },
    assignedServiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      default: null,
    },
    assignedProviderUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    currentOfferExpiresAt: { type: Date, default: null },
    attempts: { type: [dispatchAttemptSchema], default: [] },
    routePolyline: { type: String, default: null },
    routeDistanceMeters: { type: Number, default: null },
    routeDurationSeconds: { type: Number, default: null },
    ambulanceLiveLocation: { type: geoPointSchema, default: null },
    ambulanceLiveLocationUpdatedAt: { type: Date, default: null },
    acceptedAt: { type: Date, default: null },
    arrivedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true },
);

ambulanceDispatchRequestSchema.index({ clientUserId: 1, status: 1 });
ambulanceDispatchRequestSchema.index({ assignedServiceId: 1, status: 1 });
ambulanceDispatchRequestSchema.index({ status: 1, currentOfferExpiresAt: 1 });
ambulanceDispatchRequestSchema.index({ pickupLocation: "2dsphere" });

export type DispatchStatus = (typeof dispatchStatusValues)[number];
export type DispatchLocationSource = (typeof dispatchLocationSourceValues)[number];
export type DispatchAttemptOutcome = (typeof dispatchAttemptOutcomeValues)[number];

export type AmbulanceDispatchRequestDocument =
  mongoose.InferSchemaType<typeof ambulanceDispatchRequestSchema> &
    mongoose.Document;

export const AmbulanceDispatchRequest = mongoose.model(
  "AmbulanceDispatchRequest",
  ambulanceDispatchRequestSchema,
  "ambulance_dispatch_requests",
);

/** Statuses that block a client from creating another request. */
export const ACTIVE_CLIENT_DISPATCH_STATUSES: DispatchStatus[] = [
  "searching",
  "offered",
  "accepted",
  "en_route",
];

/** Statuses a client may cancel or dismiss from the UI. */
export const CLIENT_CANCELLABLE_DISPATCH_STATUSES: DispatchStatus[] = [
  "searching",
  "offered",
  "accepted",
  "no_provider",
  "expired",
];

/** Statuses that block a provider/service from receiving new offers. */
export const ACTIVE_PROVIDER_DISPATCH_STATUSES: DispatchStatus[] = [
  "offered",
  "accepted",
  "en_route",
];
