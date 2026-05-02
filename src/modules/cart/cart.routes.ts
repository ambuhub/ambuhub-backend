import { Router } from "express";
import { authenticate } from "../../shared/middlewares/authenticate";
import {
  deleteCartItemHandler,
  getCartHandler,
  patchCartItemHandler,
  postCartItemHandler,
} from "./cart.controller";

const router = Router();

router.use(authenticate);

router.get("/", getCartHandler);
router.post("/items", postCartItemHandler);
router.patch("/items/:serviceId", patchCartItemHandler);
router.delete("/items/:serviceId", deleteCartItemHandler);

export default router;
