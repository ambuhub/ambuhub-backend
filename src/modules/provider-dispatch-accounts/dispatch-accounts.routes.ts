import { Router } from "express";
import {
  authenticate,
  requireServiceProvider,
} from "../../shared/middlewares/authenticate";
import {
  createDispatchAccountHandler,
  listDispatchAccountsHandler,
  listUnlinkedGroundAmbulancesHandler,
  patchDispatchAccountHandler,
} from "./dispatch-accounts.controller";

const router = Router();

router.use(authenticate, requireServiceProvider);

router.get("/", listDispatchAccountsHandler);
router.post("/", createDispatchAccountHandler);
router.get("/available-listings", listUnlinkedGroundAmbulancesHandler);
router.patch("/:id", patchDispatchAccountHandler);

export default router;
