import { Router } from "express";

import { createRecommendationController } from "../controllers/recommendationController";
import { authMiddleware } from "../middleware/authMiddleware";

export const recommendationRoutes = Router();

recommendationRoutes.post("/", authMiddleware, createRecommendationController);

