import type { NextFunction, Request, Response } from "express";

import { AppError } from "../utils/errors";

export function adminOnly(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user || req.user.role !== "admin") {
    next(new AppError(403, "Forbidden"));
    return;
  }

  next();
}
