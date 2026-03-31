import type { NextFunction, Request, Response } from "express";

import { AppError } from "../utils/errors";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ ok: false, message: err.message });
    return;
  }

  res.status(500).json({ ok: false, message: "Internal Server Error" });
}
