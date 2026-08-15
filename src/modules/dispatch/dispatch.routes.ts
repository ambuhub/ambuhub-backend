import { Router } from "express";
import {
  authenticate,
  requireClient,
  requireDispatch,
  requireServiceProvider,
} from "../../shared/middlewares/authenticate";
import {
  acceptDispatchRequestHandler,
  cancelDispatchRequestHandler,
  getActiveDispatchRequestHandler,
  getDispatchHistoryHandler,
  getDispatchRequestHandler,
  getDispatchRouteHandler,
  getDispatchUserOfferHandler,
  getDispatchUserRequestsHandler,
  getDispatchUserServicesHandler,
  getProviderDispatchServicesHandler,
  getProviderDispatchRequestsHandler,
  getProviderOfferHandler,
  markDispatchArrivedHandler,
  patchServiceDispatchHandler,
  patchServiceLocationHandler,
  postDispatchRequestHandler,
  rejectDispatchRequestHandler,
} from "./dispatch.controller";

const router = Router();

router.post("/requests", authenticate, requireClient, postDispatchRequestHandler);
router.get(
  "/requests/me/active",
  authenticate,
  requireClient,
  getActiveDispatchRequestHandler,
);
router.get(
  "/requests/me/history",
  authenticate,
  requireClient,
  getDispatchHistoryHandler,
);
router.get("/requests/:id", authenticate, getDispatchRequestHandler);
router.patch(
  "/requests/:id/cancel",
  authenticate,
  requireClient,
  cancelDispatchRequestHandler,
);
router.get(
  "/requests/:id/route",
  authenticate,
  getDispatchRouteHandler,
);

/** Provider monitoring (no offers / no duty). */
router.get(
  "/provider/offer",
  authenticate,
  requireServiceProvider,
  getProviderOfferHandler,
);
router.get(
  "/provider/requests",
  authenticate,
  requireServiceProvider,
  getProviderDispatchRequestsHandler,
);
router.get(
  "/provider/services",
  authenticate,
  requireServiceProvider,
  getProviderDispatchServicesHandler,
);

/** Dispatch crew ops. */
router.get(
  "/crew/offer",
  authenticate,
  requireDispatch,
  getDispatchUserOfferHandler,
);
router.get(
  "/crew/requests",
  authenticate,
  requireDispatch,
  getDispatchUserRequestsHandler,
);
router.get(
  "/crew/services",
  authenticate,
  requireDispatch,
  getDispatchUserServicesHandler,
);
router.post(
  "/requests/:id/accept",
  authenticate,
  requireDispatch,
  acceptDispatchRequestHandler,
);
router.post(
  "/requests/:id/reject",
  authenticate,
  requireDispatch,
  rejectDispatchRequestHandler,
);
router.patch(
  "/requests/:id/arrived",
  authenticate,
  requireDispatch,
  markDispatchArrivedHandler,
);
router.patch(
  "/services/:serviceId/dispatch",
  authenticate,
  requireDispatch,
  patchServiceDispatchHandler,
);
router.patch(
  "/services/:serviceId/location",
  authenticate,
  requireDispatch,
  patchServiceLocationHandler,
);

export default router;
