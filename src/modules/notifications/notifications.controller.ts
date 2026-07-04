import type { Request, Response } from "express";
import {
  deleteDeviceToken,
  refreshDeviceToken,
  registerDeviceToken,
} from "./device-tokens.service";
import {
  getUnreadNotificationCount,
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NotificationsHttpError,
} from "./notifications.service";

function parseLimit(raw: unknown): number | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }
  const limit = parseInt(raw, 10);
  return Number.isFinite(limit) ? limit : undefined;
}

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
    const cursor =
      typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const result = await listMyNotifications(req.auth.userId, {
      unreadOnly,
      limit: parseLimit(req.query.limit),
      cursor,
    });
    res.status(200).json(result);
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

export async function putDeviceTokenHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const device = await registerDeviceToken(req.auth.userId, req.body ?? {});
    res.status(200).json({ device });
  } catch (err: unknown) {
    if (err instanceof NotificationsHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    throw err;
  }
}

export async function patchDeviceTokenRefreshHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const device = await refreshDeviceToken(req.auth.userId, req.body ?? {});
    res.status(200).json({ device });
  } catch (err: unknown) {
    if (err instanceof NotificationsHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    throw err;
  }
}

export async function deleteDeviceTokenHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    await deleteDeviceToken(req.auth.userId, req.body?.fcmToken);
    res.status(204).send();
  } catch (err: unknown) {
    if (err instanceof NotificationsHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    throw err;
  }
}
