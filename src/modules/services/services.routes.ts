import { Router } from "express";
import {
  authenticate,
  requireServiceProvider,
} from "../../shared/middlewares/authenticate";
import {
  getMarketplaceServices,
  getMyServices,
  postCreateService,
} from "./services.controller";

const router = Router();

router.get("/marketplace", getMarketplaceServices);
router.get("/me", authenticate, requireServiceProvider, getMyServices);
router.post("/", authenticate, requireServiceProvider, postCreateService);

export default router;
