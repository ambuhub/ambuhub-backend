import mongoose from "mongoose";
import { ConciergeRequest } from "../../models/conciergeRequest.model";
import { AdminHttpError } from "./admin.service";

export type AdminConciergeStatus = "pending" | "in_progress" | "resolved";
export type AdminConciergeStatusFilter = "all" | AdminConciergeStatus;

export type AdminConciergeStatusCounts = {
  all: number;
  pending: number;
  in_progress: number;
  resolved: number;
};

export type AdminConciergeListItem = {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  categoryName: string;
  departmentName: string;
  status: AdminConciergeStatus;
  createdAt: string;
};

export type AdminConciergeDetail = AdminConciergeListItem & {
  countryCode: string;
  categorySlug: string;
  departmentSlug: string;
  description: string;
};

export type AdminConciergeListResult = {
  requests: AdminConciergeListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  counts: AdminConciergeStatusCounts;
};

export type ListAdminConciergeParams = {
  page?: number;
  limit?: number;
  q?: string;
  status?: AdminConciergeStatusFilter;
};

function mapConciergeListItem(doc: {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  categoryName: string;
  departmentName: string;
  status: AdminConciergeStatus;
  createdAt: Date;
}): AdminConciergeListItem {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    name: doc.name,
    email: doc.email,
    phone: doc.phone,
    categoryName: doc.categoryName,
    departmentName: doc.departmentName,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
  };
}

async function getAdminConciergeStatusCounts(): Promise<AdminConciergeStatusCounts> {
  const [all, pending, inProgress, resolved] = await Promise.all([
    ConciergeRequest.countDocuments({}),
    ConciergeRequest.countDocuments({ status: "pending" }),
    ConciergeRequest.countDocuments({ status: "in_progress" }),
    ConciergeRequest.countDocuments({ status: "resolved" }),
  ]);
  return { all, pending, in_progress: inProgress, resolved };
}

function buildConciergeSearchFilter(q?: string): Record<string, unknown> {
  const trimmed = q?.trim() ?? "";
  if (!trimmed) {
    return {};
  }
  const regex = new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  return {
    $or: [
      { name: regex },
      { email: regex },
      { phone: regex },
      { categoryName: regex },
      { departmentName: regex },
      { description: regex },
    ],
  };
}

export async function listAdminConciergeRequests(
  params: ListAdminConciergeParams = {},
): Promise<AdminConciergeListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const skip = (page - 1) * limit;
  const status = params.status ?? "all";

  const filter: Record<string, unknown> = {
    ...buildConciergeSearchFilter(params.q),
  };
  if (status !== "all") {
    filter.status = status;
  }

  const [rows, total, counts] = await Promise.all([
    ConciergeRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ConciergeRequest.countDocuments(filter),
    getAdminConciergeStatusCounts(),
  ]);

  return {
    requests: rows.map((row) =>
      mapConciergeListItem(row as Parameters<typeof mapConciergeListItem>[0]),
    ),
    page,
    limit,
    total,
    totalPages: total === 0 ? 1 : Math.ceil(total / limit),
    counts,
  };
}

export async function getAdminConciergeRequestDetail(
  requestId: string,
): Promise<AdminConciergeDetail> {
  const trimmed = requestId?.trim() ?? "";
  if (!mongoose.Types.ObjectId.isValid(trimmed)) {
    throw new AdminHttpError(400, "Invalid request id");
  }

  const doc = await ConciergeRequest.findById(trimmed).lean();
  if (!doc) {
    throw new AdminHttpError(404, "Concierge request not found");
  }

  return {
    ...mapConciergeListItem(doc as Parameters<typeof mapConciergeListItem>[0]),
    countryCode: doc.countryCode,
    categorySlug: doc.categorySlug,
    departmentSlug: doc.departmentSlug,
    description: doc.description,
  };
}
