import mongoose from "mongoose";

const serviceProviderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    businessName: { type: String, required: true, trim: true },
    website: { type: String, trim: true },
    physicalAddress: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export const ServiceProvider = mongoose.model(
  "ServiceProvider",
  serviceProviderSchema,
  "serviceProviders"
);
