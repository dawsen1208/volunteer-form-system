import type { NextFunction, Request, Response } from "express";

import { AppError } from "../utils/errors";
import { recommend } from "../services/recommendationService";

export async function createRecommendationController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }
    const content =
      (req.body as { content?: unknown } | undefined)?.content ??
      (req.body as Record<string, any> | undefined);
    if (!content || typeof content !== "object") {
      throw new AppError(400, "Invalid input");
    }
    const result = await recommend(content as Record<string, any>);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
