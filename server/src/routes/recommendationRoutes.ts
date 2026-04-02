import { Router } from "express";

import {
  createRecommendationController,
  getRecommendationStatusController,
  cancelRecommendationController
} from "../controllers/recommendationController";
import { authMiddleware } from "../middleware/authMiddleware";

export const recommendationRoutes = Router();

recommendationRoutes.post("/", authMiddleware, createRecommendationController);
recommendationRoutes.get("/:formId", authMiddleware, getRecommendationStatusController);
recommendationRoutes.post("/:formId/cancel", authMiddleware, cancelRecommendationController);
