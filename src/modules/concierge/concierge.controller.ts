import type { Request, Response } from "express";
import {
  ConciergeHttpError,
  createConciergeRequest,
} from "./concierge.service";

export async function postConciergeRequestHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const request = await createConciergeRequest(req.auth.userId, {
      name: typeof body.name === "string" ? body.name : "",
      phone: typeof body.phone === "string" ? body.phone : "",
      email: typeof body.email === "string" ? body.email : "",
      countryCode: typeof body.countryCode === "string" ? body.countryCode : "",
      categorySlug:
        typeof body.categorySlug === "string" ? body.categorySlug : "",
      departmentSlug:
        typeof body.departmentSlug === "string" ? body.departmentSlug : "",
      description: typeof body.description === "string" ? body.description : "",
    });

    res.status(201).json({ request });
  } catch (err) {
    if (err instanceof ConciergeHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    throw err;
  }
}
