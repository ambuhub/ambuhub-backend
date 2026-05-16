import { Router } from "express";
import { authenticate } from "../../shared/middlewares/authenticate";
import {
  getEligibleReviewsHandler,
  getMyReviewsHandler,
  getServiceReviewsHandler,
  postReviewHandler,
} from "./reviews.controller";

const router = Router();

router.get("/by-service/:serviceId", getServiceReviewsHandler);
router.get("/me", authenticate, getMyReviewsHandler);
router.get("/me/eligible", authenticate, getEligibleReviewsHandler);
router.post("/", authenticate, postReviewHandler);

export default router;
