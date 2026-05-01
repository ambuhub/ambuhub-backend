import type { Application } from "express";
import authRoutes from "../modules/auth/auth.routes";
import countryCodesRoutes from "../modules/countryCodes/countryCodes.routes";
import serviceCategoriesRoutes from "../modules/serviceCategories/serviceCategories.routes";
import servicesRoutes from "../modules/services/services.routes";
import uploadsRoutes from "../modules/uploads/uploads.routes";

export const setupRoutes = (app: Application): void => {
  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/country-codes", countryCodesRoutes);
  app.use("/api/service-categories", serviceCategoriesRoutes);
  app.use("/api/services", servicesRoutes);
  app.use("/api/uploads", uploadsRoutes);
};
