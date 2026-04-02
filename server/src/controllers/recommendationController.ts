import type { NextFunction, Request, Response } from "express";

import { AppError } from "../utils/errors";
import { getRecommendationStatus, recommend, requestRecommendation } from "../services/recommendationService";

export async function createRecommendationController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }
    const body = (req.body as any) ?? {};
    const formId = typeof body?.formId === "string" ? body.formId : undefined;
    const content = body?.content;
    if (formId) {
      const result = await requestRecommendation({
        formId,
        role: req.user.role,
        userId: req.user.userId,
        contentOverride: content && typeof content === "object" ? (content as Record<string, any>) : undefined
      });
      res.json(result);
      return;
    }

    if (!content || typeof content !== "object") {
      throw new AppError(400, "Invalid input");
    }

    const result = await recommend(content as Record<string, any>);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getRecommendationStatusController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }
    const formId = String(req.params.formId ?? "");
    const result = await getRecommendationStatus({
      formId,
      role: req.user.role,
      userId: req.user.userId
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}
