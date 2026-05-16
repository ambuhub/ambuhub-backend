import mongoose from "mongoose";
import { Order } from "../../models/order.model";
import { Review } from "../../models/review.model";
import { User } from "../../models/user.model";

export class ReviewsHttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ReviewsHttpError";
  }
}

export type ReviewDto = {
  id: string;
  serviceId: string;
  orderId: string;
  rating: number;
  body: string;
  serviceTitle: string;
  categorySlug: string;
  lineKind: "sale" | "hire" | null;
  reviewerDisplayName: string;
  createdAt: string;
};

export type EligibleReviewDto = {
  orderId: string;
  serviceId: string;
  receiptNumber: string;
  serviceTitle: string;
  categorySlug: string;
  lineKind: "sale" | "hire" | null;
  paidAt: string;
  hireEnd: string | null;
};

export type ServiceReviewSummaryDto = {
  averageRating: number | null;
  reviewCount: number;
};

type OrderLineLean = {
  serviceId: mongoose.Types.ObjectId;
  sellerUserId?: mongoose.Types.ObjectId;
  lineKind?: "sale" | "hire";
  title: string;
  categorySlug: string;
  hireEnd?: Date;
};

function formatReviewerDisplayName(firstName: string, lastName: string): string {
  const f = firstName.trim();
  const l = lastName.trim();
  if (!f && !l) return "Ambuhub user";
  if (!l) return f;
  return `${f} ${l.charAt(0).toUpperCase()}.`;
}

function mapReviewDoc(doc: {
  _id: mongoose.Types.ObjectId;
  serviceId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  rating: number;
  body: string;
  serviceTitle: string;
  categorySlug: string;
  lineKind?: "sale" | "hire";
  reviewerFirstName: string;
  reviewerLastName: string;
  createdAt: Date;
}): ReviewDto {
  return {
    id: doc._id.toString(),
    serviceId: doc.serviceId.toString(),
    orderId: doc.orderId.toString(),
    rating: doc.rating,
    body: doc.body,
    serviceTitle: doc.serviceTitle,
    categorySlug: doc.categorySlug,
    lineKind: doc.lineKind ?? null,
    reviewerDisplayName: formatReviewerDisplayName(
      doc.reviewerFirstName,
      doc.reviewerLastName,
    ),
    createdAt: doc.createdAt.toISOString(),
  };
}

function reviewedKey(orderId: string, serviceId: string): string {
  return `${orderId}:${serviceId}`;
}

function isLineEligibleForReview(
  line: OrderLineLean,
  now: Date,
): boolean {
  const kind = line.lineKind ?? (line.hireEnd ? "hire" : "sale");
  if (kind === "hire") {
    if (!line.hireEnd) {
      return false;
    }
    return line.hireEnd.getTime() <= now.getTime();
  }
  return true;
}

export async function listMyReviews(userId: string): Promise<ReviewDto[]> {
  const uid = new mongoose.Types.ObjectId(userId);
  const rows = await Review.find({ userId: uid })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  return rows.map((r) =>
    mapReviewDoc(
      r as {
        _id: mongoose.Types.ObjectId;
        serviceId: mongoose.Types.ObjectId;
        orderId: mongoose.Types.ObjectId;
        rating: number;
        body: string;
        serviceTitle: string;
        categorySlug: string;
        lineKind?: "sale" | "hire";
        reviewerFirstName: string;
        reviewerLastName: string;
        createdAt: Date;
      },
    ),
  );
}

export async function listEligibleReviews(
  userId: string,
): Promise<EligibleReviewDto[]> {
  const uid = new mongoose.Types.ObjectId(userId);
  const [orders, existingReviews] = await Promise.all([
    Order.find({ userId: uid }).sort({ paidAt: -1 }).limit(100).lean(),
    Review.find({ userId: uid }).select("orderId serviceId").lean(),
  ]);

  const reviewed = new Set(
    existingReviews.map((r) =>
      reviewedKey(
        (r.orderId as mongoose.Types.ObjectId).toString(),
        (r.serviceId as mongoose.Types.ObjectId).toString(),
      ),
    ),
  );

  const now = new Date();
  const eligible: EligibleReviewDto[] = [];

  for (const order of orders) {
    const orderId = (order._id as mongoose.Types.ObjectId).toString();
    const receiptNumber = String(order.receiptNumber ?? "");
    const paidAt = (order.paidAt as Date).toISOString();
    const lines = (order.lines ?? []) as OrderLineLean[];

    for (const line of lines) {
      const serviceId = line.serviceId.toString();
      if (reviewed.has(reviewedKey(orderId, serviceId))) {
        continue;
      }
      if (!isLineEligibleForReview(line, now)) {
        continue;
      }
      eligible.push({
        orderId,
        serviceId,
        receiptNumber,
        serviceTitle: line.title,
        categorySlug: line.categorySlug,
        lineKind: line.lineKind ?? (line.hireEnd ? "hire" : "sale"),
        paidAt,
        hireEnd: line.hireEnd ? line.hireEnd.toISOString() : null,
      });
    }
  }

  return eligible;
}

async function assertUserMayReviewLine(
  userId: string,
  orderId: string,
  serviceId: string,
): Promise<{
  line: OrderLineLean;
  order: { receiptNumber: string; paidAt: Date };
}> {
  const trimmedOrderId = orderId?.trim() ?? "";
  const trimmedServiceId = serviceId?.trim() ?? "";
  if (
    !trimmedOrderId ||
    !mongoose.Types.ObjectId.isValid(trimmedOrderId) ||
    !trimmedServiceId ||
    !mongoose.Types.ObjectId.isValid(trimmedServiceId)
  ) {
    throw new ReviewsHttpError(400, "orderId and serviceId must be valid ObjectIds");
  }

  const order = await Order.findOne({
    _id: new mongoose.Types.ObjectId(trimmedOrderId),
    userId: new mongoose.Types.ObjectId(userId),
  }).lean();

  if (!order) {
    throw new ReviewsHttpError(404, "Order not found");
  }

  const lines = (order.lines ?? []) as OrderLineLean[];
  const line = lines.find(
    (l) => l.serviceId.toString() === trimmedServiceId,
  );
  if (!line) {
    throw new ReviewsHttpError(
      404,
      "This listing was not part of that order",
    );
  }

  const now = new Date();
  if (!isLineEligibleForReview(line, now)) {
    throw new ReviewsHttpError(
      403,
      "You can review this item after your hire period ends, or once your purchase is complete",
    );
  }

  const existing = await Review.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    orderId: new mongoose.Types.ObjectId(trimmedOrderId),
    serviceId: new mongoose.Types.ObjectId(trimmedServiceId),
  }).lean();

  if (existing) {
    throw new ReviewsHttpError(409, "You have already reviewed this purchase");
  }

  return {
    line,
    order: {
      receiptNumber: String(order.receiptNumber),
      paidAt: order.paidAt as Date,
    },
  };
}

export async function createReview(
  userId: string,
  input: {
    orderId: string;
    serviceId: string;
    rating: number;
    body: string;
  },
): Promise<ReviewDto> {
  const { line } = await assertUserMayReviewLine(
    userId,
    input.orderId,
    input.serviceId,
  );

  const rating = input.rating;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ReviewsHttpError(400, "rating must be an integer from 1 to 5");
  }

  const body = input.body?.trim() ?? "";
  if (body.length < 10) {
    throw new ReviewsHttpError(
      400,
      "Review text must be at least 10 characters",
    );
  }
  if (body.length > 2000) {
    throw new ReviewsHttpError(400, "Review text must be at most 2000 characters");
  }

  const user = await User.findById(userId).select("firstName lastName").lean();
  if (!user) {
    throw new ReviewsHttpError(404, "User not found");
  }

  const doc = await Review.create({
    userId: new mongoose.Types.ObjectId(userId),
    serviceId: new mongoose.Types.ObjectId(input.serviceId),
    orderId: new mongoose.Types.ObjectId(input.orderId),
    sellerUserId: line.sellerUserId,
    lineKind: line.lineKind ?? (line.hireEnd ? "hire" : "sale"),
    serviceTitle: line.title,
    categorySlug: line.categorySlug,
    rating,
    body,
    reviewerFirstName: user.firstName,
    reviewerLastName: user.lastName,
  });

  return mapReviewDoc(
    doc.toObject() as {
      _id: mongoose.Types.ObjectId;
      serviceId: mongoose.Types.ObjectId;
      orderId: mongoose.Types.ObjectId;
      rating: number;
      body: string;
      serviceTitle: string;
      categorySlug: string;
      lineKind?: "sale" | "hire";
      reviewerFirstName: string;
      reviewerLastName: string;
      createdAt: Date;
    },
  );
}

export async function getServiceReviewSummary(
  serviceId: string,
): Promise<ServiceReviewSummaryDto> {
  const trimmed = serviceId?.trim() ?? "";
  if (!trimmed || !mongoose.Types.ObjectId.isValid(trimmed)) {
    throw new ReviewsHttpError(400, "serviceId must be a valid ObjectId");
  }
  const sid = new mongoose.Types.ObjectId(trimmed);

  const agg = await Review.aggregate<{ avg: number; count: number }>([
    { $match: { serviceId: sid } },
    {
      $group: {
        _id: null,
        avg: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);

  const row = agg[0];
  if (!row || row.count === 0) {
    return { averageRating: null, reviewCount: 0 };
  }

  return {
    averageRating: Math.round(row.avg * 10) / 10,
    reviewCount: row.count,
  };
}

export async function listReviewsForService(
  serviceId: string,
  limit = 20,
): Promise<ReviewDto[]> {
  const trimmed = serviceId?.trim() ?? "";
  if (!trimmed || !mongoose.Types.ObjectId.isValid(trimmed)) {
    throw new ReviewsHttpError(400, "serviceId must be a valid ObjectId");
  }

  const cap = Math.min(Math.max(limit, 1), 50);
  const rows = await Review.find({
    serviceId: new mongoose.Types.ObjectId(trimmed),
  })
    .sort({ createdAt: -1 })
    .limit(cap)
    .lean();

  return rows.map((r) =>
    mapReviewDoc(
      r as {
        _id: mongoose.Types.ObjectId;
        serviceId: mongoose.Types.ObjectId;
        orderId: mongoose.Types.ObjectId;
        rating: number;
        body: string;
        serviceTitle: string;
        categorySlug: string;
        lineKind?: "sale" | "hire";
        reviewerFirstName: string;
        reviewerLastName: string;
        createdAt: Date;
      },
    ),
  );
}

/** Whether the user can submit a review for this order line (for UI hints). */
export async function canUserReviewService(
  userId: string,
  orderId: string,
  serviceId: string,
): Promise<boolean> {
  try {
    await assertUserMayReviewLine(userId, orderId, serviceId);
    return true;
  } catch (err) {
    if (err instanceof ReviewsHttpError && err.statusCode === 409) {
      return false;
    }
    if (err instanceof ReviewsHttpError) {
      return false;
    }
    throw err;
  }
}
