import { Router } from "express";
import { authenticate } from "../../shared/middlewares/authenticate";
import {
  deleteDeviceTokenHandler,
  getUnreadCountHandler,
  listMyNotificationsHandler,
  markAllReadHandler,
  markNotificationReadHandler,
  patchDeviceTokenRefreshHandler,
  putDeviceTokenHandler,
} from "./notifications.controller";

const router = Router();

router.get("/me", authenticate, listMyNotificationsHandler);
router.get("/me/unread-count", authenticate, getUnreadCountHandler);
router.patch("/me/read-all", authenticate, markAllReadHandler);
router.patch("/me/:id/read", authenticate, markNotificationReadHandler);

router.put("/me/devices", authenticate, putDeviceTokenHandler);
router.patch("/me/devices/refresh", authenticate, patchDeviceTokenRefreshHandler);
router.delete("/me/devices", authenticate, deleteDeviceTokenHandler);

export default router;
