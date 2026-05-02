import { Router } from "express";
import { authenticate, requireServiceProvider } from "../../shared/middlewares/authenticate";
import { getMyWalletHandler } from "./wallet.controller";

const router = Router();

router.use(authenticate, requireServiceProvider);
router.get("/me", getMyWalletHandler);

export default router;
