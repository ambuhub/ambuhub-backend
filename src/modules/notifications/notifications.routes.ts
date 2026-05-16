import { Router } from "express";
import { authenticate } from "../../shared/middlewares/authenticate";
import {
  getUnreadCountHandler,
  listMyNotificationsHandler,
  markAllReadHandler,
  markNotificationReadHandler,
} from "./notifications.controller";

const router = Router();

router.get("/me", authenticate, listMyNotificationsHandler);
router.get("/me/unread-count", authenticate, getUnreadCountHandler);
router.patch("/me/read-all", authenticate, markAllReadHandler);
router.patch("/me/:id/read", authenticate, markNotificationReadHandler);

export default router;
