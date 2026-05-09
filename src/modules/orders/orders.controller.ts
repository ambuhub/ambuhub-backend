import type { Request, Response } from "express";
import { requireServiceProvider } from "../../shared/middlewares/authenticate";
import { CartHttpError } from "../cart/cart.service";
import {
  getMyOrderById,
  getMyReceiptByOrderId,
  getProviderSalesByMonth,
  listMyOrders,
  listMyReceipts,
  OrdersHttpError,
  simulatePaystackCheckout,
} from "./orders.service";

export async function postSimulateCheckoutHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const result = await simulatePaystackCheckout(req.auth.userId);
    res.status(201).json(result);
  } catch (err: unknown) {
    if (err instanceof OrdersHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    if (err instanceof CartHttpError) {
      res.status(err.statusCode).json({ message: err.message });
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
    const months = await getProviderSalesByMonth(req.auth.userId, year);
    res.status(200).json({ year, months });
  } catch (err: unknown) {
    if (err instanceof OrdersHttpError) {
      res.status(err.statusCode).json({ message: err.message });
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
    if (err instanceof OrdersHttpError) {
      res.status(err.statusCode).json({ message: err.message });
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
    if (err instanceof OrdersHttpError) {
      res.status(err.statusCode).json({ message: err.message });
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
    if (err instanceof OrdersHttpError) {
      res.status(err.statusCode).json({ message: err.message });
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
    if (err instanceof OrdersHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    throw err;
  }
}
