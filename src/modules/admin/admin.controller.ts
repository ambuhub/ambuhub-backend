import type { Request, Response } from "express";
import { parseSupportedCurrency } from "../../shared/currency/types";
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
  getAdminListingDetail,
  listAdminListings,
  setAdminListingAvailability,
  type AdminListingStatusFilter,
  type AdminListingTypeFilter,
} from "./adminListings.service";
import {
  AdminNotificationsHttpError,
  getAdminUnreadNotificationCount,
  listAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
} from "./adminNotifications.service";
import {
  AdminCategoriesHttpError,
  createAdminCategory,
  listAdminCategories,
  updateAdminCategoryBySlug,
} from "./adminCategories.service";

function handleAdminError(err: unknown, res: Response, fallback: string): void {
  if (
    err instanceof AdminHttpError ||
    err instanceof AdminNotificationsHttpError ||
    err instanceof AdminCategoriesHttpError
  ) {
    res.status(err.statusCode).json({ message: err.message });
    return;
  }
  logger.error(fallback, { error: err });
  res.status(500).json({ message: fallback });
}

function parseOptionalImageUrlBodyField(
  value: unknown,
  fieldName: string,
  res: Response,
): string | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  if (value === undefined) {
    return undefined;
  }
  res.status(400).json({ message: `${fieldName} must be a string or null` });
  return undefined;
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
    const currency = parseSupportedCurrency(
      typeof req.query.currency === "string" ? req.query.currency : undefined,
    );
    const months = await getAdminTransactionsByMonth(year, currency);
    res.status(200).json({ year, currency, months });
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

export async function getAdminListingsHandler(
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

    let status: AdminListingStatusFilter = "all";
    const rawStatus = req.query.status;
    if (rawStatus === "live" || rawStatus === "taken_down") {
      status = rawStatus;
    }

    let listingType: AdminListingTypeFilter = "all";
    const rawType = req.query.listingType;
    if (rawType === "sale" || rawType === "hire" || rawType === "book") {
      listingType = rawType;
    }

    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const result = await listAdminListings({ page, limit, q, status, listingType });
    res.status(200).json(result);
  } catch (err) {
    logger.error("admin listings list failed", { error: err });
    res.status(500).json({ message: "Failed to load listings" });
  }
}

export async function getAdminListingDetailHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const serviceId =
      typeof req.params.serviceId === "string" ? req.params.serviceId : "";
    const listing = await getAdminListingDetail(serviceId);
    res.status(200).json({ listing });
  } catch (err) {
    handleAdminError(err, res, "Failed to load listing");
  }
}

export async function patchAdminListingAvailabilityHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const serviceId =
      typeof req.params.serviceId === "string" ? req.params.serviceId : "";
    const body = req.body as { isAvailable?: unknown };
    if (typeof body.isAvailable !== "boolean") {
      res.status(400).json({ message: "isAvailable must be a boolean" });
      return;
    }
    const listing = await setAdminListingAvailability(
      serviceId,
      body.isAvailable,
    );
    res.status(200).json({ listing });
  } catch (err) {
    handleAdminError(err, res, "Failed to update listing availability");
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

export async function getAdminCategoriesHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    const categories = await listAdminCategories();
    res.status(200).json({ categories });
  } catch (err) {
    handleAdminError(err, res, "Failed to load categories");
  }
}

export async function postAdminCategoryHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const body = req.body as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(body, "slug")) {
      res.status(400).json({
        message: "slug must not be sent; it is generated from name on the server",
      });
      return;
    }
    const name = body.name;
    const departments = body.departments;
    if (typeof name !== "string") {
      res.status(400).json({ message: "name is required" });
      return;
    }
    if (
      departments !== undefined &&
      departments !== null &&
      !Array.isArray(departments)
    ) {
      res.status(400).json({ message: "departments must be an array when provided" });
      return;
    }
    const deptList =
      departments === undefined || departments === null ? [] : departments;
    const parsedDepts: { name: string }[] = [];
    for (const d of deptList) {
      if (d === null || typeof d !== "object") {
        res.status(400).json({ message: "Each department must be an object" });
        return;
      }
      const o = d as Record<string, unknown>;
      if (Object.prototype.hasOwnProperty.call(o, "slug")) {
        res.status(400).json({
          message:
            "department slug must not be sent; it is generated from name on the server",
        });
        return;
      }
      if (typeof o.name !== "string") {
        res.status(400).json({ message: "Each department needs a string name" });
        return;
      }
      parsedDepts.push({ name: o.name });
    }
    const createInput: {
      name: string;
      departments?: { name: string }[];
      thumbnailUrl?: string | null;
      bannerUrl?: string | null;
    } = {
      name,
      departments: parsedDepts.length > 0 ? parsedDepts : undefined,
    };
    if (Object.prototype.hasOwnProperty.call(body, "thumbnailUrl")) {
      const thumbnailUrl = parseOptionalImageUrlBodyField(
        body.thumbnailUrl,
        "thumbnailUrl",
        res,
      );
      if (res.headersSent) {
        return;
      }
      createInput.thumbnailUrl = thumbnailUrl ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(body, "bannerUrl")) {
      const bannerUrl = parseOptionalImageUrlBodyField(
        body.bannerUrl,
        "bannerUrl",
        res,
      );
      if (res.headersSent) {
        return;
      }
      createInput.bannerUrl = bannerUrl ?? null;
    }
    const category = await createAdminCategory(createInput);
    res.status(201).json({ category });
  } catch (err) {
    handleAdminError(err, res, "Failed to create category");
  }
}

export async function patchAdminCategoryHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const raw = req.params.slug;
    const slug = Array.isArray(raw) ? raw[0] : raw;
    if (!slug?.trim()) {
      res.status(400).json({ message: "Slug is required" });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const input: {
      name?: string;
      addDepartments?: { name: string }[];
      updateDepartments?: { slug: string; name: string }[];
      thumbnailUrl?: string | null;
      bannerUrl?: string | null;
    } = {};

    if (Object.prototype.hasOwnProperty.call(body, "name")) {
      if (typeof body.name !== "string") {
        res.status(400).json({ message: "name must be a string" });
        return;
      }
      input.name = body.name;
    }

    if (Object.prototype.hasOwnProperty.call(body, "addDepartments")) {
      const rawAdd = body.addDepartments;
      if (!Array.isArray(rawAdd)) {
        res.status(400).json({ message: "addDepartments must be an array" });
        return;
      }
      const parsed: { name: string }[] = [];
      for (const item of rawAdd) {
        if (item === null || typeof item !== "object") {
          res.status(400).json({ message: "Each addDepartments entry must be an object" });
          return;
        }
        const o = item as Record<string, unknown>;
        if (typeof o.name !== "string") {
          res.status(400).json({ message: "Each addDepartments entry needs a string name" });
          return;
        }
        parsed.push({ name: o.name });
      }
      input.addDepartments = parsed;
    }

    if (Object.prototype.hasOwnProperty.call(body, "updateDepartments")) {
      const rawUpdate = body.updateDepartments;
      if (!Array.isArray(rawUpdate)) {
        res.status(400).json({ message: "updateDepartments must be an array" });
        return;
      }
      const parsed: { slug: string; name: string }[] = [];
      for (const item of rawUpdate) {
        if (item === null || typeof item !== "object") {
          res.status(400).json({
            message: "Each updateDepartments entry must be an object",
          });
          return;
        }
        const o = item as Record<string, unknown>;
        if (typeof o.slug !== "string" || typeof o.name !== "string") {
          res.status(400).json({
            message: "Each updateDepartments entry needs slug and name strings",
          });
          return;
        }
        parsed.push({ slug: o.slug, name: o.name });
      }
      input.updateDepartments = parsed;
    }

    if (Object.prototype.hasOwnProperty.call(body, "thumbnailUrl")) {
      const thumbnailUrl = parseOptionalImageUrlBodyField(
        body.thumbnailUrl,
        "thumbnailUrl",
        res,
      );
      if (res.headersSent) {
        return;
      }
      input.thumbnailUrl = thumbnailUrl ?? null;
    }

    if (Object.prototype.hasOwnProperty.call(body, "bannerUrl")) {
      const bannerUrl = parseOptionalImageUrlBodyField(
        body.bannerUrl,
        "bannerUrl",
        res,
      );
      if (res.headersSent) {
        return;
      }
      input.bannerUrl = bannerUrl ?? null;
    }

    const category = await updateAdminCategoryBySlug(slug, input);
    res.status(200).json({ category });
  } catch (err) {
    handleAdminError(err, res, "Failed to update category");
  }
}
