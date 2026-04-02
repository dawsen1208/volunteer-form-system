import { Router } from "express";

import {
  createRecommendationController,
  getRecommendationStatusController
} from "../controllers/recommendationController";
import { authMiddleware } from "../middleware/authMiddleware";

export const recommendationRoutes = Router();

recommendationRoutes.post("/", authMiddleware, createRecommendationController);
recommendationRoutes.get("/:formId", authMiddleware, getRecommendationStatusController);
