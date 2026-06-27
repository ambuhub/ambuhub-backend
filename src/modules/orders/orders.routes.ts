import { Router } from "express";
import { authenticate, requireServiceProvider } from "../../shared/middlewares/authenticate";
import {
  getMyOrderHandler,
  getMyReceiptByOrderHandler,
  getPaystackConfigHandler,
  getProviderHireBookingsHandler,
  getProviderPersonnelBookingsHandler,
  getProviderSalesHandler,
  getProviderSalesByMonthHandler,
  listMyOrdersHandler,
  listMyReceiptsHandler,
  postBookPaystackInitializeHandler,
  postHirePaystackInitializeHandler,
  postPaystackCancelHandler,
  postPaystackVerifyHandler,
  postSalePaystackInitializeHandler,
} from "./orders.controller";

const router = Router();

router.get("/paystack/config", getPaystackConfigHandler);
router.post("/checkout/paystack/initialize", authenticate, postSalePaystackInitializeHandler);
router.post(
  "/hire-checkout/paystack/initialize",
  authenticate,
  postHirePaystackInitializeHandler,
);
router.post(
  "/book-checkout/paystack/initialize",
  authenticate,
  postBookPaystackInitializeHandler,
);
router.post("/paystack/verify", authenticate, postPaystackVerifyHandler);
router.post("/paystack/cancel", authenticate, postPaystackCancelHandler);

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
router.get(
  "/provider/bookings",
  authenticate,
  requireServiceProvider,
  getProviderPersonnelBookingsHandler,
);
router.get(
  "/provider/sales",
  authenticate,
  requireServiceProvider,
  getProviderSalesHandler,
);
router.get("/me", authenticate, listMyOrdersHandler);
router.get("/me/:orderId", authenticate, getMyOrderHandler);

export default router;

const receiptsRouter = Router();

receiptsRouter.use(authenticate);
receiptsRouter.get("/me", listMyReceiptsHandler);
receiptsRouter.get("/me/by-order/:orderId", getMyReceiptByOrderHandler);

export { receiptsRouter };
