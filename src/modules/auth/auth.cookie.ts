import type { Response } from "express";

export const AUTH_COOKIE_NAME = "ambuhub_access_token";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const baseCookieOptions = {
  httpOnly: true as const,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, {
    ...baseCookieOptions,
    maxAge: SEVEN_DAYS_MS,
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, {
    ...baseCookieOptions,
  });
}
