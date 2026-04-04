import type { Application } from "express";
import authRoutes from "../modules/auth/auth.routes";
import serviceCategoriesRoutes from "../modules/serviceCategories/serviceCategories.routes";

export const setupRoutes = (app: Application): void => {
  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/service-categories", serviceCategoriesRoutes);
};
