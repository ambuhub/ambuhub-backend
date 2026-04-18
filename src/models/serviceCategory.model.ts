import mongoose from "mongoose";

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    order: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const serviceCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, unique: true },
    /** When true, seed may delete this row if its slug is removed from the code catalog. */
    catalogManaged: { type: Boolean, default: true },
    departments: {
      type: [departmentSchema],
      default: [],
    },
    thumbnailUrl: { type: String, trim: true },
    bannerUrl: { type: String, trim: true },
    /** Short descriptive note for marketing / category pages */
    note: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

export type ServiceCategoryDepartment = {
  name: string;
  slug: string;
  order: number;
};

export type ServiceCategoryDocument =
  mongoose.InferSchemaType<typeof serviceCategorySchema> & mongoose.Document;

/** MongoDB collection name: serviceCategories */
export const ServiceCategory = mongoose.model(
  "ServiceCategory",
  serviceCategorySchema,
  "serviceCategories"
);
