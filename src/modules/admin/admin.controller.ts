import type { Request, Response } from "express";
import { logger } from "../../shared/lib/logger";
import {
  AdminHttpError,
  applyAdminUserAction,
  getAdminDashboardStats,
  getAdminOrderDetail,
  getAdminOrderReceipt,
  getAdminTransactionsByMonth,
  getAdminUserDetail,
  listAdminOrders,
  listAdminUsers,
  type AdminUserAction,
} from "./admin.service";
import {
  getAdminConciergeRequestDetail,
  listAdminConciergeRequests,
} from "./adminConcierge.service";
import {
  AdminNotificationsHttpError,
  getAdminUnreadNotificationCount,
  listAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
} from "./adminNotifications.service";

function handleAdminError(err: unknown, res: Response, fallback: string): void {
  if (err instanceof AdminHttpError || err instanceof AdminNotificationsHttpError) {
    res.status(err.statusCode).json({ message: err.message });
    return;
  }
  logger.error(fallback, { error: err });
  res.status(500).json({ message: fallback });
}

export async function getAdminDashboardStatsHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    const stats = await getAdminDashboardStats();
    res.status(200).json({ stats });
  } catch (err) {
    logger.error("admin dashboard stats failed", { error: err });
    res.status(500).json({ message: "Failed to load dashboard stats" });
  }
}

export async function getAdminTransactionsByMonthHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const defaultYear = new Date().getUTCFullYear();
    let year = defaultYear;
    const rawYear = req.query.year;
    if (typeof rawYear === "string" && /^\d{4}$/.test(rawYear)) {
      const y = parseInt(rawYear, 10);
      if (y >= 2000 && y <= 2100) {
        year = y;
      }
    }
    const months = await getAdminTransactionsByMonth(year);
    res.status(200).json({ year, months });
  } catch (err) {
    logger.error("admin transactions by month failed", { error: err });
    res.status(500).json({ message: "Failed to load transactions by month" });
  }
}

export async function getAdminUsersHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    let page = 1;
    let limit = 20;
    const rawPage = req.query.page;
    const rawLimit = req.query.limit;
    if (typeof rawPage === "string" && /^\d+$/.test(rawPage)) {
      page = Math.max(1, parseInt(rawPage, 10));
    }
    if (typeof rawLimit === "string" && /^\d+$/.test(rawLimit)) {
      limit = Math.min(100, Math.max(1, parseInt(rawLimit, 10)));
    }

    let role: "all" | "client" | "service_provider" | "admin" = "all";
    const rawRole = req.query.role;
    if (
      rawRole === "client" ||
      rawRole === "service_provider" ||
      rawRole === "admin"
    ) {
      role = rawRole;
    }

    const q = typeof req.query.q === "string" ? req.query.q : undefined;

    const result = await listAdminUsers({ page, limit, q, role });
    res.status(200).json(result);
  } catch (err) {
    logger.error("admin users list failed", { error: err });
    res.status(500).json({ message: "Failed to load users" });
  }
}

export async function getAdminUserDetailHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const userId = typeof req.params.userId === "string" ? req.params.userId : "";
    const user = await getAdminUserDetail(userId);
    res.status(200).json({ user });
  } catch (err) {
    handleAdminError(err, res, "Failed to load user");
  }
}

export async function patchAdminUserHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const userId = typeof req.params.userId === "string" ? req.params.userId : "";
    const body = req.body as { action?: string };
    const action = body.action;
    const validActions: AdminUserAction[] = [
      "verify",
      "unverify",
      "suspend",
      "unsuspend",
      "promote_to_provider",
      "demote_to_client",
    ];
    if (typeof action !== "string" || !validActions.includes(action as AdminUserAction)) {
      res.status(400).json({ message: "Invalid action" });
      return;
    }
    const user = await applyAdminUserAction(
      userId,
      req.auth.userId,
      action as AdminUserAction,
    );
    res.status(200).json({ user });
  } catch (err) {
    handleAdminError(err, res, "Failed to update user");
  }
}

export async function getAdminOrdersHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    let page = 1;
    let limit = 20;
    const rawPage = req.query.page;
    const rawLimit = req.query.limit;
    if (typeof rawPage === "string" && /^\d+$/.test(rawPage)) {
      page = Math.max(1, parseInt(rawPage, 10));
    }
    if (typeof rawLimit === "string" && /^\d+$/.test(rawLimit)) {
      limit = Math.min(100, Math.max(1, parseInt(rawLimit, 10)));
    }

    let kind: "all" | "sale" | "hire" | "book" = "all";
    const rawKind = req.query.kind;
    if (rawKind === "sale" || rawKind === "hire" || rawKind === "book") {
      kind = rawKind;
    }

    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const result = await listAdminOrders({ page, limit, q, kind });
    res.status(200).json(result);
  } catch (err) {
    logger.error("admin orders list failed", { error: err });
    res.status(500).json({ message: "Failed to load orders" });
  }
}

export async function getAdminOrderDetailHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const orderId =
      typeof req.params.orderId === "string" ? req.params.orderId : "";
    const order = await getAdminOrderDetail(orderId);
    res.status(200).json({ order });
  } catch (err) {
    handleAdminError(err, res, "Failed to load order");
  }
}

export async function getAdminOrderReceiptHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const orderId =
      typeof req.params.orderId === "string" ? req.params.orderId : "";
    const receipt = await getAdminOrderReceipt(orderId);
    res.status(200).json({ receipt });
  } catch (err) {
    handleAdminError(err, res, "Failed to load receipt");
  }
}

export async function getAdminConciergeRequestsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    let page = 1;
    let limit = 20;
    const rawPage = req.query.page;
    const rawLimit = req.query.limit;
    if (typeof rawPage === "string" && /^\d+$/.test(rawPage)) {
      page = Math.max(1, parseInt(rawPage, 10));
    }
    if (typeof rawLimit === "string" && /^\d+$/.test(rawLimit)) {
      limit = Math.min(100, Math.max(1, parseInt(rawLimit, 10)));
    }

    let status: "all" | "pending" | "in_progress" | "resolved" = "all";
    const rawStatus = req.query.status;
    if (
      rawStatus === "pending" ||
      rawStatus === "in_progress" ||
      rawStatus === "resolved"
    ) {
      status = rawStatus;
    }

    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const result = await listAdminConciergeRequests({ page, limit, q, status });
    res.status(200).json(result);
  } catch (err) {
    logger.error("admin concierge list failed", { error: err });
    res.status(500).json({ message: "Failed to load concierge requests" });
  }
}

export async function getAdminConciergeRequestDetailHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const requestId =
      typeof req.params.requestId === "string" ? req.params.requestId : "";
    const request = await getAdminConciergeRequestDetail(requestId);
    res.status(200).json({ request });
  } catch (err) {
    handleAdminError(err, res, "Failed to load concierge request");
  }
}

export async function getAdminNotificationsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const unreadOnly = req.query.unreadOnly === "true";
    let limit = 50;
    const rawLimit = req.query.limit;
    if (typeof rawLimit === "string" && /^\d+$/.test(rawLimit)) {
      limit = Math.min(100, Math.max(1, parseInt(rawLimit, 10)));
    }
    const notifications = await listAdminNotifications(req.auth.userId, {
      unreadOnly,
      limit,
    });
    res.status(200).json({ notifications });
  } catch (err) {
    handleAdminError(err, res, "Failed to load notifications");
  }
}

export async function getAdminUnreadNotificationCountHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const count = await getAdminUnreadNotificationCount(req.auth.userId);
    res.status(200).json({ count });
  } catch (err) {
    handleAdminError(err, res, "Failed to load notification count");
  }
}

export async function patchAdminNotificationReadHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const notificationId =
      typeof req.params.notificationId === "string"
        ? req.params.notificationId
        : "";
    const notification = await markAdminNotificationRead(
      req.auth.userId,
      notificationId,
    );
    res.status(200).json({ notification });
  } catch (err) {
    handleAdminError(err, res, "Failed to mark notification read");
  }
}

export async function patchAdminNotificationsReadAllHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const modifiedCount = await markAllAdminNotificationsRead(req.auth.userId);
    res.status(200).json({ modifiedCount });
  } catch (err) {
    handleAdminError(err, res, "Failed to mark notifications read");
  }
}
