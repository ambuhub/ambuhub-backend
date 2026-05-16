import { Router } from "express";
import { authenticate } from "../../shared/middlewares/authenticate";
import {
  changePasswordHandler,
  forgotPasswordHandler,
  getMeHandler,
  loginHandler,
  logoutHandler,
  patchMeHandler,
  registerHandler,
} from "./auth.controller";

const router = Router();

router.post("/register", registerHandler);
router.post("/login", loginHandler);
router.post("/logout", logoutHandler);
router.post("/forgot-password", forgotPasswordHandler);
router.get("/me", authenticate, getMeHandler);
router.patch("/me", authenticate, patchMeHandler);
router.post("/change-password", authenticate, changePasswordHandler);

export default router;
