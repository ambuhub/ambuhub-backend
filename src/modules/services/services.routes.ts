import { Router } from "express";
import {
  authenticate,
  requireServiceProvider,
} from "../../shared/middlewares/authenticate";
import {
  getMarketplaceServices,
  getMyServices,
  postCreateService,
  putUpdateService,
} from "./services.controller";

const router = Router();

router.get("/marketplace", getMarketplaceServices);
router.get("/me", authenticate, requireServiceProvider, getMyServices);
router.post("/", authenticate, requireServiceProvider, postCreateService);
router.put("/:id", authenticate, requireServiceProvider, putUpdateService);

export default router;
