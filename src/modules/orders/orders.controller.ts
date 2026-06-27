import type { Request, Response } from "express";
import { parseSupportedCurrency } from "../../shared/currency/types";
import { requireServiceProvider } from "../../shared/middlewares/authenticate";
import { CartHttpError } from "../cart/cart.service";
import {
  getMyOrderById,
  getMyReceiptByOrderId,
  getProviderSalesByMonth,
  listMyOrders,
  listMyReceipts,
  listProviderHireBookings,
  listProviderPersonnelBookings,
  listProviderSales,
  OrdersHttpError,
} from "./orders.service";
import {
  cancelPaystackCheckout,
  getPaystackCheckoutConfig,
  initializeBookPaystackCheckout,
  initializeHirePaystackCheckout,
  initializeSalePaystackCheckout,
  verifyPaystackCheckout,
} from "./paystack-checkout.service";

function handleOrdersError(res: Response, err: unknown): boolean {
  if (err instanceof OrdersHttpError) {
    res.status(err.statusCode).json({ message: err.message });
    return true;
  }
  if (err instanceof CartHttpError) {
    res.status(err.statusCode).json({ message: err.message });
    return true;
  }
  return false;
}

export async function getPaystackConfigHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  res.status(200).json(getPaystackCheckoutConfig());
}

export async function postSalePaystackInitializeHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const payment = await initializeSalePaystackCheckout(req.auth.userId);
    res.status(200).json({ payment });
  } catch (err: unknown) {
    if (handleOrdersError(res, err)) {
      return;
    }
    throw err;
  }
}

export async function postHirePaystackInitializeHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const payment = await initializeHirePaystackCheckout(
      req.auth.userId,
      req.body ?? {},
    );
    res.status(200).json({ payment });
  } catch (err: unknown) {
    if (handleOrdersError(res, err)) {
      return;
    }
    throw err;
  }
}

export async function postBookPaystackInitializeHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const payment = await initializeBookPaystackCheckout(
      req.auth.userId,
      req.body ?? {},
    );
    res.status(200).json({ payment });
  } catch (err: unknown) {
    if (handleOrdersError(res, err)) {
      return;
    }
    throw err;
  }
}

export async function postPaystackVerifyHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const reference =
      typeof req.body?.reference === "string" ? req.body.reference : "";
    const result = await verifyPaystackCheckout(req.auth.userId, reference);
    res.status(201).json(result);
  } catch (err: unknown) {
    if (handleOrdersError(res, err)) {
      return;
    }
    throw err;
  }
}

export async function postPaystackCancelHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const reference =
      typeof req.body?.reference === "string" ? req.body.reference : "";
    await cancelPaystackCheckout(req.auth.userId, reference);
    res.status(204).send();
  } catch (err: unknown) {
    if (handleOrdersError(res, err)) {
      return;
    }
    throw err;
  }
}

export async function getProviderHireBookingsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const bookings = await listProviderHireBookings(req.auth.userId);
    res.status(200).json({ bookings });
  } catch (err: unknown) {
    if (handleOrdersError(res, err)) {
      return;
    }
    throw err;
  }
}

export async function getProviderPersonnelBookingsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const bookings = await listProviderPersonnelBookings(req.auth.userId);
    res.status(200).json({ bookings });
  } catch (err: unknown) {
    if (handleOrdersError(res, err)) {
      return;
    }
    throw err;
  }
}

export async function getProviderSalesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const sales = await listProviderSales(req.auth.userId);
    res.status(200).json({ sales });
  } catch (err: unknown) {
    if (handleOrdersError(res, err)) {
      return;
    }
    throw err;
  }
}

export async function getProviderSalesByMonthHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const defaultYear = new Date().getUTCFullYear();
    let year = defaultYear;
    const rawYear = req.query.year;
    if (typeof rawYear === "string" && /^\d{4}$/.test(rawYear)) {
      const y = parseInt(rawYear, 10);
      if (y >= 2000 && y <= 2100) {
        year = y;
      }
    }
    const currency = parseSupportedCurrency(
      typeof req.query.currency === "string" ? req.query.currency : undefined,
    );
    const months = await getProviderSalesByMonth(req.auth.userId, year, currency);
    res.status(200).json({ year, currency, months });
  } catch (err: unknown) {
    if (handleOrdersError(res, err)) {
      return;
    }
    throw err;
  }
}

export async function listMyOrdersHandler(req: Request, res: Response): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const orders = await listMyOrders(req.auth.userId);
    res.status(200).json({ orders });
  } catch (err: unknown) {
    if (handleOrdersError(res, err)) {
      return;
    }
    throw err;
  }
}

export async function getMyOrderHandler(req: Request, res: Response): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const orderId = typeof req.params.orderId === "string" ? req.params.orderId : "";
    const order = await getMyOrderById(req.auth.userId, orderId);
    res.status(200).json({ order });
  } catch (err: unknown) {
    if (handleOrdersError(res, err)) {
      return;
    }
    throw err;
  }
}

export async function listMyReceiptsHandler(req: Request, res: Response): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const receipts = await listMyReceipts(req.auth.userId);
    res.status(200).json({ receipts });
  } catch (err: unknown) {
    if (handleOrdersError(res, err)) {
      return;
    }
    throw err;
  }
}

export async function getMyReceiptByOrderHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const orderId = typeof req.params.orderId === "string" ? req.params.orderId : "";
    const receipt = await getMyReceiptByOrderId(req.auth.userId, orderId);
    res.status(200).json({ receipt });
  } catch (err: unknown) {
    if (handleOrdersError(res, err)) {
      return;
    }
    throw err;
  }
}
