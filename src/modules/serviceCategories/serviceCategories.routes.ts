import { Router } from "express";
import {
  getServiceCategoryBySlugHandler,
  listServiceCategoriesHandler,
  postCreateServiceCategoryHandler,
  putServiceCategoryBySlugHandler,
} from "./serviceCategories.controller";

const router = Router();

router.get("/", listServiceCategoriesHandler);
router.post("/", postCreateServiceCategoryHandler);
router.put("/:slug", putServiceCategoryBySlugHandler);
router.get("/:slug", getServiceCategoryBySlugHandler);

export default router;
