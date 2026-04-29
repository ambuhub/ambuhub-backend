import { Router } from "express";
import {
  authenticate,
  requireServiceProvider,
} from "../../shared/middlewares/authenticate";
import {
  deleteMyService,
  getMarketplaceServices,
  getMyServiceByIdHandler,
  getMyServices,
  postCreateService,
  putUpdateService,
} from "./services.controller";

const router = Router();

router.get("/marketplace", getMarketplaceServices);
router.get("/me", authenticate, requireServiceProvider, getMyServices);
router.get(
  "/me/:serviceId",
  authenticate,
  requireServiceProvider,
  getMyServiceByIdHandler
);
router.post("/", authenticate, requireServiceProvider, postCreateService);
router.put("/:id", authenticate, requireServiceProvider, putUpdateService);
router.delete("/:id", authenticate, requireServiceProvider, deleteMyService);

export default router;
