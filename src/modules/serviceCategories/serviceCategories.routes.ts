import { Router } from "express";
import {
  getServiceCategoryBySlugHandler,
  listServiceCategoriesHandler,
} from "./serviceCategories.controller";

const router = Router();

router.get("/", listServiceCategoriesHandler);
router.get("/:slug", getServiceCategoryBySlugHandler);

export default router;
