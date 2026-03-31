import type { NextFunction, Request, Response } from "express";

import { AppError } from "../utils/errors";
import { verifyAuthToken } from "../utils/jwt";

export function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const header = req.header("authorization") ?? req.header("Authorization");
  if (!header) {
    next(new AppError(401, "Unauthorized"));
    return;
  }

  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) {
    next(new AppError(401, "Unauthorized"));
    return;
  }

  try {
    const payload = verifyAuthToken(token);
    if (payload.role === "user" && !payload.userId) {
      next(new AppError(401, "Unauthorized"));
      return;
    }
    req.user = { role: payload.role, userId: payload.userId, phone: payload.phone };
    next();
  } catch (err) {
    next(err);
  }
}
