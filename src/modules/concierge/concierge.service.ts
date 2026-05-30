import mongoose from "mongoose";
import { ConciergeRequest } from "../../models/conciergeRequest.model";
import { ServiceCategory } from "../../models/serviceCategory.model";
import { normalizeCountryCode } from "../../shared/lib/countryCode";
import { notifyAdminsOfConciergeRequest } from "../admin/adminNotifications.service";

export const CONCIERGE_SOMETHING_ELSE_SLUG = "something-else";
export const CONCIERGE_SOMETHING_ELSE_NAME = "Something else";

export class ConciergeHttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ConciergeHttpError";
  }
}

export type CreateConciergeRequestInput = {
  name: string;
  phone: string;
  email: string;
  countryCode: string;
  categorySlug: string;
  departmentSlug: string;
  description: string;
};

export type ConciergeRequestDto = {
  id: string;
  name: string;
  phone: string;
  email: string;
  countryCode: string;
  categorySlug: string;
  categoryName: string;
  departmentSlug: string;
  departmentName: string;
  description: string;
  status: "pending" | "in_progress" | "resolved";
  createdAt: string;
};

function trimRequired(value: string, field: string, maxLen: number): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    throw new ConciergeHttpError(400, `${field} is required`);
  }
  if (trimmed.length > maxLen) {
    throw new ConciergeHttpError(400, `${field} is too long`);
  }
  return trimmed;
}

async function resolveCategoryAndDepartment(
  categorySlug: string,
  departmentSlug: string,
): Promise<{
  categoryName: string;
  departmentName: string;
}> {
  if (categorySlug === CONCIERGE_SOMETHING_ELSE_SLUG) {
    if (departmentSlug !== CONCIERGE_SOMETHING_ELSE_SLUG) {
      throw new ConciergeHttpError(
        400,
        'Department must be "Something else" when category is "Something else"',
      );
    }
    return {
      categoryName: CONCIERGE_SOMETHING_ELSE_NAME,
      departmentName: CONCIERGE_SOMETHING_ELSE_NAME,
    };
  }

  const category = await ServiceCategory.findOne({ slug: categorySlug }).lean();
  if (!category) {
    throw new ConciergeHttpError(400, "Invalid service category");
  }

  if (departmentSlug === CONCIERGE_SOMETHING_ELSE_SLUG) {
    return {
      categoryName: category.name,
      departmentName: CONCIERGE_SOMETHING_ELSE_NAME,
    };
  }

  const department = category.departments.find((d) => d.slug === departmentSlug);
  if (!department) {
    throw new ConciergeHttpError(400, "Invalid department for this category");
  }

  return {
    categoryName: category.name,
    departmentName: department.name,
  };
}

export async function createConciergeRequest(
  userId: string,
  input: CreateConciergeRequestInput,
): Promise<ConciergeRequestDto> {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ConciergeHttpError(400, "Invalid user id");
  }

  const name = trimRequired(input.name, "Name", 200);
  const phone = trimRequired(input.phone, "Phone number", 40);
  const email = trimRequired(input.email, "Email", 320);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ConciergeHttpError(400, "Invalid email address");
  }

  const countryCode = normalizeCountryCode(input.countryCode);
  if (!countryCode) {
    throw new ConciergeHttpError(400, "Invalid country");
  }

  const categorySlug = trimRequired(input.categorySlug, "Service category", 120);
  const departmentSlug = trimRequired(input.departmentSlug, "Department", 120);
  const description = trimRequired(input.description, "Description", 5000);
  if (description.length < 10) {
    throw new ConciergeHttpError(
      400,
      "Description must be at least 10 characters",
    );
  }

  const { categoryName, departmentName } = await resolveCategoryAndDepartment(
    categorySlug,
    departmentSlug,
  );

  const doc = await ConciergeRequest.create({
    userId: new mongoose.Types.ObjectId(userId),
    name,
    phone,
    email,
    countryCode,
    categorySlug,
    categoryName,
    departmentSlug,
    departmentName,
    description,
    status: "pending",
  });

  const result: ConciergeRequestDto = {
    id: doc._id.toString(),
    name: doc.name,
    phone: doc.phone,
    email: doc.email,
    countryCode: doc.countryCode,
    categorySlug: doc.categorySlug,
    categoryName: doc.categoryName,
    departmentSlug: doc.departmentSlug,
    departmentName: doc.departmentName,
    description: doc.description,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
  };

  await notifyAdminsOfConciergeRequest({
    id: result.id,
    name: result.name,
    categoryName: result.categoryName,
    departmentName: result.departmentName,
  });

  return result;
}
