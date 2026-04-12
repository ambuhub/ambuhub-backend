import mongoose from "mongoose";

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
    departmentSlug: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    photoUrls: { type: [String], default: [] },
  },
  { timestamps: true }
);

serviceSchema.index({ userId: 1, createdAt: -1 });

export type ServiceDocument =
  mongoose.InferSchemaType<typeof serviceSchema> & mongoose.Document;

export const Service = mongoose.model("Service", serviceSchema, "services");
