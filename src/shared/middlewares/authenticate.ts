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

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || typeof header !== "string") {
    return null;
  }
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) {
    return null;
  }
  return match[1].trim();
}

function verifyAndAttachAuth(
  token: string,
  req: Request,
  res: Response,
): boolean {
  let secret: string;
  try {
    secret = requireJwtSecret();
  } catch {
    res.status(500).json({ message: "Server misconfiguration" });
    return false;
  }

  try {
    const decoded = jwt.verify(token, secret) as jwt.JwtPayload;
    const userId = String(decoded.sub ?? decoded.userId ?? "");
    const role = typeof decoded.role === "string" ? decoded.role : "";
    if (!userId || !role) {
      res.status(401).json({ message: "Invalid token" });
      return false;
    }
    req.auth = { userId, role };
    return true;
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
    return false;
  }
}

export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
  if (cookieToken && typeof cookieToken === "string") {
    if (verifyAndAttachAuth(cookieToken, req, res)) {
      next();
    }
    return;
  }

  const bearerToken = extractBearerToken(req);
  if (bearerToken) {
    if (verifyAndAttachAuth(bearerToken, req, res)) {
      next();
    }
    return;
  }

  res.status(401).json({ message: "Unauthorized" });
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

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.auth) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  if (req.auth.role !== "admin") {
    res.status(403).json({ message: "Forbidden" });
    return;
  }
  next();
}

export function requireServiceProviderOrAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.auth) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  if (req.auth.role !== "service_provider" && req.auth.role !== "admin") {
    res.status(403).json({ message: "Forbidden" });
    return;
  }
  next();
}
