import mongoose from "mongoose";
import {
  AdminActivityLog,
  ADMIN_ACTIVITY_ACTION_LABELS,
  adminActivityActionValues,
  type AdminActivityAction,
  type AdminActivityEntityType,
} from "../../models/adminActivityLog.model";
import { User } from "../../models/user.model";
import { logger } from "../../shared/lib/logger";
import { AdminHttpError } from "./admin.service";

export type RecordAdminActivityInput = {
  actorUserId: string;
  action: AdminActivityAction;
  entityType: AdminActivityEntityType;
  entityId?: string;
  summary: string;
  metadata?: Record<string, unknown>;
};

export type AdminActivityLogListItem = {
  id: string;
  actorUserId: string;
  actorName: string;
  actorEmail: string;
  action: AdminActivityAction;
  actionLabel: string;
  entityType: AdminActivityEntityType;
  entityId: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type AdminActivityLogsListResult = {
  logs: AdminActivityLogListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ListAdminActivityLogsParams = {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  sort?: "newest" | "oldest";
  action?: AdminActivityAction | "all";
  q?: string;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseBoundaryDate(
  raw: string | undefined,
  bound: "start" | "end",
): Date | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-").map((part) => parseInt(part, 10));
    if (bound === "start") {
      return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
    }
    return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new AdminHttpError(
      400,
      `Invalid ${bound === "start" ? "from" : "to"} date`,
    );
  }
  return parsed;
}

function mapActivityLog(doc: {
  _id: mongoose.Types.ObjectId;
  actorUserId: mongoose.Types.ObjectId;
  actorName: string;
  actorEmail: string;
  action: AdminActivityAction;
  entityType: AdminActivityEntityType;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}): AdminActivityLogListItem {
  return {
    id: doc._id.toString(),
    actorUserId: doc.actorUserId.toString(),
    actorName: doc.actorName,
    actorEmail: doc.actorEmail,
    action: doc.action,
    actionLabel: ADMIN_ACTIVITY_ACTION_LABELS[doc.action] ?? doc.action,
    entityType: doc.entityType,
    entityId: doc.entityId?.trim() ? doc.entityId.trim() : null,
    summary: doc.summary,
    metadata:
      doc.metadata && typeof doc.metadata === "object" ? doc.metadata : {},
    createdAt:
      doc.createdAt instanceof Date
        ? doc.createdAt.toISOString()
        : new Date(doc.createdAt).toISOString(),
  };
}

export async function recordAdminActivity(
  input: RecordAdminActivityInput,
): Promise<void> {
  try {
    if (!mongoose.Types.ObjectId.isValid(input.actorUserId)) {
      logger.warn("Skipped activity log: invalid actorUserId", {
        actorUserId: input.actorUserId,
        action: input.action,
      });
      return;
    }

    const actor = await User.findById(input.actorUserId)
      .select("firstName lastName email")
      .lean();
    if (!actor) {
      logger.warn("Skipped activity log: actor not found", {
        actorUserId: input.actorUserId,
        action: input.action,
      });
      return;
    }

    const actorName =
      `${actor.firstName ?? ""} ${actor.lastName ?? ""}`.trim() ||
      actor.email ||
      "Admin";
    const summary = input.summary.trim();
    if (!summary) {
      return;
    }

    await AdminActivityLog.create({
      actorUserId: new mongoose.Types.ObjectId(input.actorUserId),
      actorName,
      actorEmail: actor.email ?? "",
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId?.trim() || undefined,
      summary: summary.slice(0, 500),
      metadata: input.metadata ?? {},
    });
  } catch (err) {
    logger.error("Failed to record admin activity", {
      error: err,
      action: input.action,
    });
  }
}

export function activityActionForUserAction(
  action:
    | "verify"
    | "unverify"
    | "suspend"
    | "unsuspend"
    | "promote_to_provider"
    | "demote_to_client",
): AdminActivityAction {
  switch (action) {
    case "verify":
      return "user_verified";
    case "unverify":
      return "user_unverified";
    case "suspend":
      return "user_suspended";
    case "unsuspend":
      return "user_unsuspended";
    case "promote_to_provider":
      return "user_promoted_to_provider";
    case "demote_to_client":
      return "user_demoted_to_client";
  }
}

export async function listAdminActivityLogs(
  params: ListAdminActivityLogsParams = {},
): Promise<AdminActivityLogsListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const sortDir = params.sort === "oldest" ? 1 : -1;

  const fromDate = parseBoundaryDate(params.from, "start");
  const toDate = parseBoundaryDate(params.to, "end");
  if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
    throw new AdminHttpError(400, "`from` must be on or before `to`");
  }

  const filter: Record<string, unknown> = {};
  if (fromDate || toDate) {
    const createdAt: Record<string, Date> = {};
    if (fromDate) createdAt.$gte = fromDate;
    if (toDate) createdAt.$lte = toDate;
    filter.createdAt = createdAt;
  }

  if (
    params.action &&
    params.action !== "all" &&
    (adminActivityActionValues as readonly string[]).includes(params.action)
  ) {
    filter.action = params.action;
  }

  const q = params.q?.trim() ?? "";
  if (q) {
    const regex = new RegExp(escapeRegex(q), "i");
    filter.$or = [
      { summary: regex },
      { actorName: regex },
      { actorEmail: regex },
      { entityId: regex },
    ];
  }

  const skip = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    AdminActivityLog.find(filter)
      .sort({ createdAt: sortDir, _id: sortDir })
      .skip(skip)
      .limit(limit)
      .lean(),
    AdminActivityLog.countDocuments(filter),
  ]);

  return {
    logs: rows.map((row) =>
      mapActivityLog(row as Parameters<typeof mapActivityLog>[0]),
    ),
    page,
    limit,
    total,
    totalPages: total === 0 ? 1 : Math.ceil(total / limit),
  };
}
