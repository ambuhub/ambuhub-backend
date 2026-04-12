import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AUTH_COOKIE_NAME } from "../../modules/auth/auth.cookie";

export interface AuthPayload {
  userId: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return secret;
}

export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (!token || typeof token !== "string") {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  let secret: string;
  try {
    secret = requireJwtSecret();
  } catch {
    res.status(500).json({ message: "Server misconfiguration" });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret) as jwt.JwtPayload;
    const userId = String(decoded.sub ?? decoded.userId ?? "");
    const role = typeof decoded.role === "string" ? decoded.role : "";
    if (!userId || !role) {
      res.status(401).json({ message: "Invalid token" });
      return;
    }
    req.auth = { userId, role };
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function requireServiceProvider(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.auth) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  if (req.auth.role !== "service_provider") {
    res.status(403).json({ message: "Forbidden" });
    return;
  }
  next();
}
