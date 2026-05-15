import path from "path";
import swaggerJsdoc from "swagger-jsdoc";

const port = process.env.PORT || "3002";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "AmbuHub API",
      version: "1.0.0",
      description:
        "REST API for AmbuHub. Authenticated routes use the httpOnly cookie `ambuhub_access_token` (set by login/register). In Swagger UI, log in first, then call protected endpoints with credentials enabled.",
    },
    servers: [
      {
        url: process.env.BACKEND_URL || `http://localhost:${port}`, 
        description: "Local development",
      },
    ],
  },
  apis: [
    path.join(__dirname, "../swagger/components.ts"),
    path.join(__dirname, "../swagger/responses.ts"),
    path.join(__dirname, "../swagger/paths/*.ts"),
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
