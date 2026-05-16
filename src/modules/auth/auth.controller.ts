import type { Request, Response } from "express";
import { clearAuthCookie, setAuthCookie } from "./auth.cookie";
import {
  AuthHttpError,
  changePassword,
  getSessionUser,
  login,
  register,
  resetPasswordWithoutVerification,
  updateClientProfile,
  updateProviderProfile,
} from "./auth.service";
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

export async function forgotPasswordHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const body = req.body as Record<string, unknown>;
    await resetPasswordWithoutVerification({
      email: String(body.email ?? ""),
      newPassword: String(body.newPassword ?? ""),
    });
    res.status(200).json({
      ok: true,
      message:
        "If an account exists for that email, the password has been updated. You can sign in with the new password.",
    });
  } catch (err) {
    if (err instanceof AuthHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    logger.error("forgot password failed", { error: err });
    res.status(500).json({ message: "Could not reset password" });
  }
}

export async function getMeHandler(req: Request, res: Response): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const user = await getSessionUser(req.auth.userId);
    if (!user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    res.status(200).json({ user });
  } catch (err) {
    logger.error("getMe failed", { error: err });
    res.status(500).json({ message: "Could not load session" });
  }
}

export async function patchMeHandler(req: Request, res: Response): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const role = req.auth.role;

    if (role === "service_provider") {
      const user = await updateProviderProfile(req.auth.userId, {
        firstName: typeof body.firstName === "string" ? body.firstName : "",
        lastName: typeof body.lastName === "string" ? body.lastName : "",
        phone: typeof body.phone === "string" ? body.phone : "",
        countryCode: typeof body.countryCode === "string" ? body.countryCode : "",
        businessName:
          typeof body.businessName === "string" ? body.businessName : "",
        physicalAddress:
          typeof body.physicalAddress === "string" ? body.physicalAddress : "",
        website: typeof body.website === "string" ? body.website : undefined,
      });
      res.status(200).json({ user });
      return;
    }

    if (role === "client") {
      const user = await updateClientProfile(req.auth.userId, {
        firstName: typeof body.firstName === "string" ? body.firstName : "",
        lastName: typeof body.lastName === "string" ? body.lastName : "",
        phone: typeof body.phone === "string" ? body.phone : "",
        countryCode: typeof body.countryCode === "string" ? body.countryCode : "",
        dateOfBirth:
          typeof body.dateOfBirth === "string" ? body.dateOfBirth : "",
      });
      res.status(200).json({ user });
      return;
    }

    res.status(403).json({ message: "This account cannot update profile here" });
  } catch (err) {
    if (err instanceof AuthHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    logger.error("patchMe failed", { error: err });
    res.status(500).json({ message: "Could not update profile" });
  }
}

export async function changePasswordHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const body = req.body as Record<string, unknown>;
    await changePassword(req.auth.userId, {
      currentPassword:
        typeof body.currentPassword === "string" ? body.currentPassword : "",
      newPassword:
        typeof body.newPassword === "string" ? body.newPassword : "",
    });
    res.status(200).json({
      ok: true,
      message: "Password updated successfully",
    });
  } catch (err) {
    if (err instanceof AuthHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    logger.error("changePassword failed", { error: err });
    res.status(500).json({ message: "Could not change password" });
  }
}
