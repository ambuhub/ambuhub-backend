import type { Request, Response } from "express";
import { clearAuthCookie, setAuthCookie } from "./auth.cookie";
import { AuthHttpError, login, register } from "./auth.service";
import { logger } from "../../shared/lib/logger";

export async function registerHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const result = await register(req.body);
    setAuthCookie(res, result.token);
    res.status(201).json({ user: result.user });
  } catch (err) {
    if (err instanceof AuthHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    logger.error("register failed", { error: err });
    res.status(500).json({ message: "Registration failed" });
  }
}

export async function loginHandler(req: Request, res: Response): Promise<void> {
  try {
    const result = await login(req.body);
    setAuthCookie(res, result.token);
    res.status(200).json({ user: result.user });
  } catch (err) {
    if (err instanceof AuthHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    logger.error("login failed", { error: err });
    res.status(500).json({ message: "Login failed" });
  }
}

export function logoutHandler(_req: Request, res: Response): void {
  clearAuthCookie(res);
  res.status(200).json({ ok: true });
}
