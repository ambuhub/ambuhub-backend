import mongoose from "mongoose";

export const adminActivityActionValues = [
  "admin_created",
  "user_verified",
  "user_unverified",
  "user_suspended",
  "user_unsuspended",
  "user_promoted_to_provider",
  "user_demoted_to_client",
  "category_created",
  "category_updated",
  "listing_enabled",
  "listing_disabled",
] as const;

export type AdminActivityAction = (typeof adminActivityActionValues)[number];

export const adminActivityEntityTypeValues = [
  "user",
  "category",
  "listing",
] as const;

export type AdminActivityEntityType =
  (typeof adminActivityEntityTypeValues)[number];

export const ADMIN_ACTIVITY_ACTION_LABELS: Record<AdminActivityAction, string> =
  {
    admin_created: "Admin created",
    user_verified: "User verified",
    user_unverified: "User unverified",
    user_suspended: "User suspended",
    user_unsuspended: "User unsuspended",
    user_promoted_to_provider: "User promoted to provider",
    user_demoted_to_client: "User demoted to client",
    category_created: "Category created",
    category_updated: "Category updated",
    listing_enabled: "Listing enabled",
    listing_disabled: "Listing disabled",
  };

const adminActivityLogSchema = new mongoose.Schema(
  {
    actorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    actorName: { type: String, required: true, trim: true, maxlength: 200 },
    actorEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 320,
    },
    action: {
      type: String,
      enum: adminActivityActionValues,
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      enum: adminActivityEntityTypeValues,
      required: true,
    },
    entityId: { type: String, required: false, trim: true, maxlength: 120 },
    summary: { type: String, required: true, trim: true, maxlength: 500 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

adminActivityLogSchema.index({ createdAt: -1 });
adminActivityLogSchema.index({ action: 1, createdAt: -1 });

export const AdminActivityLog = mongoose.model(
  "AdminActivityLog",
  adminActivityLogSchema,
);
