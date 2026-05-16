import { Router } from "express";
import {
  getStatesByCountryCode,
  getVerifyCountryCode,
} from "./countryCodes.controller";

const router = Router();

router.get("/:code/states", getStatesByCountryCode);
router.get("/:code", getVerifyCountryCode);

export default router;
