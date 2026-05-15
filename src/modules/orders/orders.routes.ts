import { Router } from "express";
import { authenticate, requireServiceProvider } from "../../shared/middlewares/authenticate";
import {
  getMyOrderHandler,
  getMyReceiptByOrderHandler,
  getProviderHireBookingsHandler,
  getProviderSalesByMonthHandler,
  listMyOrdersHandler,
  listMyReceiptsHandler,
  postHireSimulateCheckoutHandler,
  postSimulateCheckoutHandler,
} from "./orders.controller";

const router = Router();

router.post("/checkout/simulate-paystack", authenticate, postSimulateCheckoutHandler);
router.post(
  "/hire-checkout/simulate-paystack",
  authenticate,
  postHireSimulateCheckoutHandler,
);
router.get(
  "/provider/sales-by-month",
  authenticate,
  requireServiceProvider,
  getProviderSalesByMonthHandler,
);
router.get(
  "/provider/hire-bookings",
  authenticate,
  requireServiceProvider,
  getProviderHireBookingsHandler,
);
router.get("/me", authenticate, listMyOrdersHandler);
router.get("/me/:orderId", authenticate, getMyOrderHandler);

export default router;

const receiptsRouter = Router();

receiptsRouter.use(authenticate);
receiptsRouter.get("/me", listMyReceiptsHandler);
receiptsRouter.get("/me/by-order/:orderId", getMyReceiptByOrderHandler);

export { receiptsRouter };
