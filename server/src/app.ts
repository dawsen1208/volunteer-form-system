import cors from "cors";
import express from "express";

import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { notFoundHandler } from "./middleware/notFound";
import { apiRoutes } from "./routes";
import { formRoutes } from "./routes/formRoutes";
import { myRoutes } from "./routes/myRoutes";

const corsOrigin =
  env.CORS_ORIGIN === "*"
    ? true
    : env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean);

export const app = express();

app.use(cors({ origin: corsOrigin }));
app.options("*", cors({ origin: corsOrigin }));
app.use(express.json());

app.use("/api", apiRoutes);
app.use("/api/forms", formRoutes);
app.use("/api/my", myRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
