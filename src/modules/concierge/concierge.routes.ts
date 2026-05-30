import { Router } from "express";
import { authenticate } from "../../shared/middlewares/authenticate";
import { postConciergeRequestHandler } from "./concierge.controller";

const router = Router();

router.post("/requests", authenticate, postConciergeRequestHandler);

export default router;
