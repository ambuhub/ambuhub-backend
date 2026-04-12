import { Router } from "express";
import { loginHandler, logoutHandler, registerHandler } from "./auth.controller";

const router = Router();

router.post("/register", registerHandler);
router.post("/login", loginHandler);
router.post("/logout", logoutHandler);

export default router;
