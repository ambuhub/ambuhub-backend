import { Router } from "express";
import { authenticate, requireServiceProvider } from "../../shared/middlewares/authenticate";
import {
  getProviderSubscriptionHandler,
  postPremiumSubscriptionCancelHandler,
  postPremiumSubscriptionInitializeHandler,
  postPremiumSubscriptionVerifyHandler,
} from "./subscription.controller";

const router = Router();

router.get("/", authenticate, requireServiceProvider, getProviderSubscriptionHandler);
router.post(
  "/paystack/initialize",
  authenticate,
  requireServiceProvider,
  postPremiumSubscriptionInitializeHandler,
);
router.post(
  "/paystack/verify",
  authenticate,
  requireServiceProvider,
  postPremiumSubscriptionVerifyHandler,
);
router.post(
  "/paystack/cancel",
  authenticate,
  requireServiceProvider,
  postPremiumSubscriptionCancelHandler,
);

export default router;
