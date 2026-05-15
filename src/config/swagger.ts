import path from "path";
import swaggerJsdoc from "swagger-jsdoc";

const port = process.env.PORT || "3002";
const serverUrl = process.env.BACKEND_URL || `http://localhost:${port}`;
const isLocalServer =
  serverUrl.includes("localhost") || serverUrl.includes("127.0.0.1");

/** `.ts` when run via ts-node-dev; `.js` when run from `dist/` on Render. */
const docExt = __filename.endsWith(".ts") ? "ts" : "js";

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
        url: serverUrl,
        description: isLocalServer ? "Local development" : "Production",
      },
    ],
  },
  apis: [
    path.join(__dirname, `../swagger/components.${docExt}`),
    path.join(__dirname, `../swagger/responses.${docExt}`),
    path.join(__dirname, `../swagger/paths/*.${docExt}`),
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
