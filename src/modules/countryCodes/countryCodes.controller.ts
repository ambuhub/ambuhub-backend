import type { Request, Response } from "express";
import { normalizeCountryCode } from "../../shared/lib/countryCode";

/**
 * GET /api/country-codes/:code
 * Returns whether the code exists in the configured ISO alpha-2 set (world-countries).
 */
export function getVerifyCountryCode(req: Request, res: Response): void {
  const param = req.params.code;
  const raw = Array.isArray(param) ? param[0] ?? "" : param ?? "";
  const normalized = normalizeCountryCode(raw);
  if (!normalized) {
    res.status(400).json({
      valid: false,
      message: "Invalid ISO 3166-1 alpha-2 country code",
    });
    return;
  }
  res.status(200).json({ valid: true, code: normalized });
}
