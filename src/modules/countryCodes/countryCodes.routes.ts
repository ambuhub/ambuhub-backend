import { Router } from "express";
import { getVerifyCountryCode } from "./countryCodes.controller";

const router = Router();

router.get("/:code", getVerifyCountryCode);

export default router;
