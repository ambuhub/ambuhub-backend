import type { Request, Response } from "express";
import {
  cancelPremiumSubscriptionCheckout,
  getProviderSubscription,
  initializePremiumSubscriptionCheckout,
  SubscriptionHttpError,
  verifyPremiumSubscriptionCheckout,
} from "./subscription.service";

function handleSubscriptionError(res: Response, err: unknown): boolean {
  if (err instanceof SubscriptionHttpError) {
    res.status(err.statusCode).json({ message: err.message });
    return true;
  }
  return false;
}

export async function getProviderSubscriptionHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const subscription = await getProviderSubscription(req.auth.userId);
    res.status(200).json({ subscription });
  } catch (err: unknown) {
    if (handleSubscriptionError(res, err)) {
      return;
    }
    throw err;
  }
}

export async function postPremiumSubscriptionInitializeHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const payment = await initializePremiumSubscriptionCheckout(
      req.auth.userId,
      req.body ?? {},
    );
    res.status(200).json({ payment });
  } catch (err: unknown) {
    if (handleSubscriptionError(res, err)) {
      return;
    }
    throw err;
  }
}

export async function postPremiumSubscriptionVerifyHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const result = await verifyPremiumSubscriptionCheckout(
      req.auth.userId,
      (req.body as { reference?: unknown } | undefined)?.reference,
    );
    res.status(200).json(result);
  } catch (err: unknown) {
    if (handleSubscriptionError(res, err)) {
      return;
    }
    throw err;
  }
}

export async function postPremiumSubscriptionCancelHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    await cancelPremiumSubscriptionCheckout(
      req.auth.userId,
      (req.body as { reference?: unknown } | undefined)?.reference,
    );
    res.status(204).send();
  } catch (err: unknown) {
    if (handleSubscriptionError(res, err)) {
      return;
    }
    throw err;
  }
}
