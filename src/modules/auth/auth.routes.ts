import { Router } from "express";
import { authenticate } from "../../shared/middlewares/authenticate";
import {
  forgotPasswordHandler,
  getMeHandler,
  loginHandler,
  logoutHandler,
  registerHandler,
} from "./auth.controller";

const router = Router();

router.post("/register", registerHandler);
router.post("/login", loginHandler);
router.post("/logout", logoutHandler);
router.post("/forgot-password", forgotPasswordHandler);
router.get("/me", authenticate, getMeHandler);

export default router;
