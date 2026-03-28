import type { Request, Response } from "express";
import { AuthHttpError, login, register } from "./auth.service";
import { logger } from "../../shared/lib/logger";

export async function registerHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const result = await register(req.body);
    res.status(201).json(result);
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
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof AuthHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    logger.error("login failed", { error: err });
    res.status(500).json({ message: "Login failed" });
  }
}
