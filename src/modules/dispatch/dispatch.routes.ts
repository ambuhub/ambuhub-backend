import { Router } from "express";
import {
  authenticate,
  requireClient,
  requireServiceProvider,
} from "../../shared/middlewares/authenticate";
import {
  acceptDispatchRequestHandler,
  cancelDispatchRequestHandler,
  getActiveDispatchRequestHandler,
  getDispatchHistoryHandler,
  getDispatchRequestHandler,
  getDispatchRouteHandler,
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
router.post(
  "/requests/:id/accept",
  authenticate,
  requireServiceProvider,
  acceptDispatchRequestHandler,
);
router.post(
  "/requests/:id/reject",
  authenticate,
  requireServiceProvider,
  rejectDispatchRequestHandler,
);
router.patch(
  "/requests/:id/arrived",
  authenticate,
  requireServiceProvider,
  markDispatchArrivedHandler,
);
router.patch(
  "/services/:serviceId/dispatch",
  authenticate,
  requireServiceProvider,
  patchServiceDispatchHandler,
);
router.patch(
  "/services/:serviceId/location",
  authenticate,
  requireServiceProvider,
  patchServiceLocationHandler,
);

export default router;
