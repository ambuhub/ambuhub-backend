import type { Request, Response } from "express";
import {
  createReview,
  getServiceReviewSummary,
  listEligibleReviews,
  listMyReviews,
  listReviewsForService,
  ReviewsHttpError,
} from "./reviews.service";

export async function getMyReviewsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const reviews = await listMyReviews(req.auth.userId);
    res.status(200).json({ reviews });
  } catch (err: unknown) {
    if (err instanceof ReviewsHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    throw err;
  }
}

export async function getEligibleReviewsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const eligible = await listEligibleReviews(req.auth.userId);
    res.status(200).json({ eligible });
  } catch (err: unknown) {
    if (err instanceof ReviewsHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    throw err;
  }
}

export async function postReviewHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    const serviceId = typeof body.serviceId === "string" ? body.serviceId : "";
    const ratingRaw = body.rating;
    const rating =
      typeof ratingRaw === "number"
        ? ratingRaw
        : typeof ratingRaw === "string"
          ? Number(ratingRaw)
          : NaN;
    const reviewBody = typeof body.body === "string" ? body.body : "";

    if (!orderId.trim() || !serviceId.trim()) {
      res.status(400).json({ message: "orderId and serviceId are required" });
      return;
    }

    const review = await createReview(req.auth.userId, {
      orderId,
      serviceId,
      rating,
      body: reviewBody,
    });
    res.status(201).json({ review });
  } catch (err: unknown) {
    if (err instanceof ReviewsHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    throw err;
  }
}

export async function getServiceReviewsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const rawId = req.params.serviceId;
    const serviceId = typeof rawId === "string" ? rawId : "";
    const rawLimit = req.query.limit;
    const limit =
      rawLimit === undefined
        ? 20
        : Array.isArray(rawLimit)
          ? Number(rawLimit[0])
          : Number(rawLimit);

    const [summary, reviews] = await Promise.all([
      getServiceReviewSummary(serviceId),
      listReviewsForService(serviceId, Number.isFinite(limit) ? limit : 20),
    ]);
    res.status(200).json({ summary, reviews });
  } catch (err: unknown) {
    if (err instanceof ReviewsHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    throw err;
  }
}
