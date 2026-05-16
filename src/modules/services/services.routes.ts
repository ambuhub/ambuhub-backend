import { Router } from "express";
import {
  authenticate,
  requireServiceProvider,
} from "../../shared/middlewares/authenticate";
import {
  deleteFavoriteHandler,
  deleteMyService,
  getBookingAvailabilityHandler,
  getMarketplaceServiceByIdHandler,
  getMarketplaceServices,
  getMyFavoriteServicesHandler,
  getMyServiceByIdHandler,
  getMyServices,
  patchBookingSettingsHandler,
  patchServiceAvailability,
  postAddFavoriteHandler,
  postCreateService,
  putUpdateService,
} from "./services.controller";

const router = Router();

router.get("/marketplace", getMarketplaceServices);
router.get(
  "/marketplace/:serviceId/booking-availability",
  getBookingAvailabilityHandler,
);
router.get("/marketplace/:serviceId", getMarketplaceServiceByIdHandler);
router.get("/favorites/me", authenticate, getMyFavoriteServicesHandler);
router.post("/favorites/me", authenticate, postAddFavoriteHandler);
router.delete(
  "/favorites/me/:serviceId",
  authenticate,
  deleteFavoriteHandler,
);
router.get("/me", authenticate, requireServiceProvider, getMyServices);
router.get(
  "/me/:serviceId",
  authenticate,
  requireServiceProvider,
  getMyServiceByIdHandler
);
router.post("/", authenticate, requireServiceProvider, postCreateService);
router.patch(
  "/:id/availability",
  authenticate,
  requireServiceProvider,
  patchServiceAvailability
);
router.patch(
  "/me/:serviceId/booking-settings",
  authenticate,
  requireServiceProvider,
  patchBookingSettingsHandler,
);
router.put("/:id", authenticate, requireServiceProvider, putUpdateService);
router.delete("/:id", authenticate, requireServiceProvider, deleteMyService);

export default router;
