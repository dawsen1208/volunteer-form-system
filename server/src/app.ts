import cors from "cors";
import express from "express";

import { env } from "./config/env";
import { healthzController } from "./controllers/healthController";
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

app.get("/healthz", healthzController);
app.get("/api/healthz", healthzController);

app.use("/", apiRoutes);
app.use("/forms", formRoutes);
app.use("/my", myRoutes);

app.use("/api", apiRoutes);
app.use("/api/forms", formRoutes);
app.use("/api/my", myRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
