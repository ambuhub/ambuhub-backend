import type { Request, Response } from "express";
import {
  addCartItem,
  CartHttpError,
  getCart,
  removeCartItem,
  setCartItemQuantity,
} from "./cart.service";

export async function getCartHandler(req: Request, res: Response): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const cart = await getCart(req.auth.userId);
    res.status(200).json({ cart });
  } catch (err: unknown) {
    if (err instanceof CartHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    throw err;
  }
}

export async function postCartItemHandler(req: Request, res: Response): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const serviceId = String(body.serviceId ?? "");
    const quantity = body.quantity;
    const cart = await addCartItem(req.auth.userId, serviceId, quantity);
    res.status(200).json({ cart });
  } catch (err: unknown) {
    if (err instanceof CartHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    throw err;
  }
}

export async function patchCartItemHandler(req: Request, res: Response): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const serviceId = typeof req.params.serviceId === "string" ? req.params.serviceId : "";
    const body = req.body as Record<string, unknown>;
    const cart = await setCartItemQuantity(req.auth.userId, serviceId, body.quantity);
    res.status(200).json({ cart });
  } catch (err: unknown) {
    if (err instanceof CartHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    throw err;
  }
}

export async function deleteCartItemHandler(req: Request, res: Response): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const serviceId = typeof req.params.serviceId === "string" ? req.params.serviceId : "";
    const cart = await removeCartItem(req.auth.userId, serviceId);
    res.status(200).json({ cart });
  } catch (err: unknown) {
    if (err instanceof CartHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    throw err;
  }
}
