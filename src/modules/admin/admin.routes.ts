import { Router } from "express";
import { authenticate, requireAdmin } from "../../shared/middlewares/authenticate";
import {
  getAdminCategoriesHandler,
  getAdminConciergeRequestDetailHandler,
  getAdminConciergeRequestsHandler,
  getAdminDashboardStatsHandler,
  getAdminListingDetailHandler,
  getAdminListingsHandler,
  getAdminNotificationsHandler,
  getAdminOrderDetailHandler,
  getAdminOrderReceiptHandler,
  getAdminOrdersHandler,
  getAdminTransactionsByMonthHandler,
  getAdminUnreadNotificationCountHandler,
  getAdminUserDetailHandler,
  getAdminUsersHandler,
  patchAdminListingAvailabilityHandler,
  patchAdminCategoryHandler,
  patchAdminNotificationReadHandler,
  patchAdminNotificationsReadAllHandler,
  patchAdminUserHandler,
  postAdminCategoryHandler,
} from "./admin.controller";

const router = Router();

router.use(authenticate, requireAdmin);
router.get("/stats", getAdminDashboardStatsHandler);
router.get("/transactions-by-month", getAdminTransactionsByMonthHandler);
router.get("/users", getAdminUsersHandler);
router.get("/users/:userId", getAdminUserDetailHandler);
router.patch("/users/:userId", patchAdminUserHandler);
router.get("/orders", getAdminOrdersHandler);
router.get("/orders/:orderId/receipt", getAdminOrderReceiptHandler);
router.get("/orders/:orderId", getAdminOrderDetailHandler);
router.get("/concierge-requests", getAdminConciergeRequestsHandler);
router.get("/concierge-requests/:requestId", getAdminConciergeRequestDetailHandler);
router.get("/categories", getAdminCategoriesHandler);
router.post("/categories", postAdminCategoryHandler);
router.patch("/categories/:slug", patchAdminCategoryHandler);
router.get("/listings", getAdminListingsHandler);
router.get("/listings/:serviceId", getAdminListingDetailHandler);
router.patch(
  "/listings/:serviceId/availability",
  patchAdminListingAvailabilityHandler,
);
router.get("/notifications/unread-count", getAdminUnreadNotificationCountHandler);
router.get("/notifications", getAdminNotificationsHandler);
router.patch("/notifications/read-all", patchAdminNotificationsReadAllHandler);
router.patch(
  "/notifications/:notificationId/read",
  patchAdminNotificationReadHandler,
);

export default router;
