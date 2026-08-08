import type { Request, Response } from "express";
import { clearAuthCookie, setAuthCookie } from "./auth.cookie";
import {
  AuthHttpError,
  adminLogin,
  changePassword,
  getSessionUser,
  getVerifyEmailOtpStatus,
  login,
  register,
  requestChangeEmailOtp,
  requestPasswordResetOtp,
  resendChangeEmailOtp,
  resendVerifyEmailOtp,
  resetPasswordWithToken,
  updateClientProfile,
  updateProviderProfile,
  verifyChangeEmailAndIssueSession,
  verifyEmailAndIssueSession,
  verifyPasswordResetOtp,
} from "./auth.service";
import { logger } from "../../shared/lib/logger";

export async function registerHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const result = await register(req.body);
    setAuthCookie(res, result.token);
    res.status(201).json({
      token: result.token,
      user: result.user,
      requiresEmailVerification: result.requiresEmailVerification ?? false,
      otp: result.otp,
    });
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
    res.status(200).json({
      token: result.token,
      user: result.user,
      requiresEmailVerification: result.requiresEmailVerification ?? false,
      otp: result.otp,
    });
  } catch (err) {
    if (err instanceof AuthHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    logger.error("login failed", { error: err });
    res.status(500).json({ message: "Login failed" });
  }
}

export async function adminLoginHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const result = await adminLogin(req.body);
    setAuthCookie(res, result.token);
    res.status(200).json({ token: result.token, user: result.user });
  } catch (err) {
    if (err instanceof AuthHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    logger.error("admin login failed", { error: err });
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
    const result = await requestPasswordResetOtp({
      email: typeof body.email === "string" ? body.email : "",
      force: true,
    });
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof AuthHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    logger.error("forgot password request failed", { error: err });
    res.status(500).json({ message: "Could not start password reset" });
  }
}

export async function forgotPasswordResendHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const body = req.body as Record<string, unknown>;
    const result = await requestPasswordResetOtp({
      email: typeof body.email === "string" ? body.email : "",
      force: false,
    });
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof AuthHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    logger.error("forgot password resend failed", { error: err });
    res.status(500).json({ message: "Could not resend verification code" });
  }
}

export async function forgotPasswordVerifyHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const body = req.body as Record<string, unknown>;
    const result = await verifyPasswordResetOtp({
      email: typeof body.email === "string" ? body.email : "",
      code: typeof body.code === "string" ? body.code : "",
    });
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof AuthHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    logger.error("forgot password verify failed", { error: err });
    res.status(500).json({ message: "Could not verify code" });
  }
}

export async function forgotPasswordResetHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const body = req.body as Record<string, unknown>;
    const result = await resetPasswordWithToken({
      resetToken: typeof body.resetToken === "string" ? body.resetToken : "",
      newPassword:
        typeof body.newPassword === "string" ? body.newPassword : "",
    });
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof AuthHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    logger.error("forgot password reset failed", { error: err });
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

export async function getVerifyEmailStatusHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const status = await getVerifyEmailOtpStatus(req.auth.userId);
    res.status(200).json(status);
  } catch (err) {
    if (err instanceof AuthHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    logger.error("get verify email status failed", { error: err });
    res.status(500).json({ message: "Could not load verification status" });
  }
}

export async function verifyEmailHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const code = typeof body.code === "string" ? body.code : "";
    const result = await verifyEmailAndIssueSession(req.auth.userId, code);
    setAuthCookie(res, result.token);
    res.status(200).json({ token: result.token, user: result.user });
  } catch (err) {
    if (err instanceof AuthHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    logger.error("verify email failed", { error: err });
    res.status(500).json({ message: "Could not verify email" });
  }
}

export async function resendVerifyEmailHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const otp = await resendVerifyEmailOtp(req.auth.userId);
    res.status(200).json({ otp });
  } catch (err) {
    if (err instanceof AuthHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    logger.error("resend verify email failed", { error: err });
    res.status(500).json({ message: "Could not resend verification code" });
  }
}

export async function requestChangeEmailHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const newEmail = typeof body.newEmail === "string" ? body.newEmail : "";
    const password = typeof body.password === "string" ? body.password : "";
    const otp = await requestChangeEmailOtp({
      userId: req.auth.userId,
      newEmail,
      password,
    });
    res.status(200).json({
      ok: true,
      message: "Verification code sent to your new email address",
      otp,
    });
  } catch (err) {
    if (err instanceof AuthHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    logger.error("request change email failed", { error: err });
    res.status(500).json({ message: "Could not start email change" });
  }
}

export async function verifyChangeEmailHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const code = typeof body.code === "string" ? body.code : "";
    const result = await verifyChangeEmailAndIssueSession({
      userId: req.auth.userId,
      code,
    });
    setAuthCookie(res, result.token);
    res.status(200).json({ token: result.token, user: result.user });
  } catch (err) {
    if (err instanceof AuthHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    logger.error("verify change email failed", { error: err });
    res.status(500).json({ message: "Could not verify new email" });
  }
}

export async function resendChangeEmailHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const otp = await resendChangeEmailOtp(req.auth.userId);
    res.status(200).json({ otp });
  } catch (err) {
    if (err instanceof AuthHttpError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    logger.error("resend change email failed", { error: err });
    res.status(500).json({ message: "Could not resend verification code" });
  }
}
