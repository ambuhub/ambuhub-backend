import cors from "cors";
import express, { type Application } from "express";

export const setupMiddleware = (app: Application): void => {
  const frontendOrigin = process.env.FRONTEND_URL || "http://localhost:3000";
  app.use(
    cors({
      origin: frontendOrigin,
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
};
