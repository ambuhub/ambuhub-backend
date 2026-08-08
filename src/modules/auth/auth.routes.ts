import { Router } from "express";
import { authenticate } from "../../shared/middlewares/authenticate";
import {
  adminLoginHandler,
  changePasswordHandler,
  forgotPasswordHandler,
  forgotPasswordResendHandler,
  forgotPasswordResetHandler,
  forgotPasswordVerifyHandler,
  getMeHandler,
  getVerifyEmailStatusHandler,
  loginHandler,
  logoutHandler,
  patchMeHandler,
  registerHandler,
  requestChangeEmailHandler,
  resendChangeEmailHandler,
  resendVerifyEmailHandler,
  verifyChangeEmailHandler,
  verifyEmailHandler,
} from "./auth.controller";

const router = Router();

router.post("/register", registerHandler);
router.post("/login", loginHandler);
router.post("/admin/login", adminLoginHandler);
router.post("/logout", logoutHandler);
router.post("/forgot-password", forgotPasswordHandler);
router.post("/forgot-password/resend", forgotPasswordResendHandler);
router.post("/forgot-password/verify", forgotPasswordVerifyHandler);
router.post("/forgot-password/reset", forgotPasswordResetHandler);
router.get("/me", authenticate, getMeHandler);
router.patch("/me", authenticate, patchMeHandler);
router.post("/change-password", authenticate, changePasswordHandler);
router.get("/verify-email", authenticate, getVerifyEmailStatusHandler);
router.post("/verify-email", authenticate, verifyEmailHandler);
router.post("/verify-email/resend", authenticate, resendVerifyEmailHandler);
router.post("/change-email", authenticate, requestChangeEmailHandler);
router.post("/change-email/verify", authenticate, verifyChangeEmailHandler);
router.post("/change-email/resend", authenticate, resendChangeEmailHandler);

export default router;
