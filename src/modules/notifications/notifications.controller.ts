import type { Request, Response } from "express";
import {
  getUnreadNotificationCount,
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NotificationsHttpError,
} from "./notifications.service";

export async function listMyNotificationsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const unreadOnly = req.query.unreadOnly === "true";
    const limitRaw = req.query.limit;
    const limit =
      typeof limitRaw === "string" ? parseInt(limitRaw, 10) : undefined;
    const notifications = await listMyNotifications(req.auth.userId, {
      unreadOnly,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    res.status(200).json({ notifications });
  } catch (err: unknown) {
    if (err instanceof NotificationsHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    throw err;
  }
}

export async function getUnreadCountHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const count = await getUnreadNotificationCount(req.auth.userId);
    res.status(200).json({ count });
  } catch (err: unknown) {
    if (err instanceof NotificationsHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    throw err;
  }
}

export async function markNotificationReadHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const id = typeof req.params.id === "string" ? req.params.id : "";
    const notification = await markNotificationRead(req.auth.userId, id);
    res.status(200).json({ notification });
  } catch (err: unknown) {
    if (err instanceof NotificationsHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    throw err;
  }
}

export async function markAllReadHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const modifiedCount = await markAllNotificationsRead(req.auth.userId);
    res.status(200).json({ modifiedCount });
  } catch (err: unknown) {
    if (err instanceof NotificationsHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    throw err;
  }
}
