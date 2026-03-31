import { Router } from "express";

import { healthzController } from "../controllers/healthController";

export const healthRoutes = Router();

healthRoutes.get("/healthz", healthzController);

