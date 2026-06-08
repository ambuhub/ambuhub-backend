import { Router } from "express";
import { getMarketplaceCountryHandler } from "./marketplace.controller";

const router = Router();

router.get("/country", getMarketplaceCountryHandler);

export default router;
