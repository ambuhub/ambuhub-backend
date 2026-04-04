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
    departments: {
      type: [departmentSchema],
      default: [],
    },
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
