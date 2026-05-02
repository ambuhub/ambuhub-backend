import type { Application } from "express";
import authRoutes from "../modules/auth/auth.routes";
import cartRoutes from "../modules/cart/cart.routes";
import countryCodesRoutes from "../modules/countryCodes/countryCodes.routes";
import ordersRoutes, { receiptsRouter } from "../modules/orders/orders.routes";
import serviceCategoriesRoutes from "../modules/serviceCategories/serviceCategories.routes";
import servicesRoutes from "../modules/services/services.routes";
import uploadsRoutes from "../modules/uploads/uploads.routes";
import walletRoutes from "../modules/wallet/wallet.routes";

export const setupRoutes = (app: Application): void => {
  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/cart", cartRoutes);
  app.use("/api/country-codes", countryCodesRoutes);
  app.use("/api/orders", ordersRoutes);
  app.use("/api/receipts", receiptsRouter);
  app.use("/api/service-categories", serviceCategoriesRoutes);
  app.use("/api/services", servicesRoutes);
  app.use("/api/uploads", uploadsRoutes);
  app.use("/api/wallet", walletRoutes);
};
