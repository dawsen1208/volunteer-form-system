import type { NextFunction, Request, Response } from "express";

import { isAppError } from "../utils/errors";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (isAppError(err)) {
    const message =
      typeof (err as any).message === "string" && (err as any).message.trim()
        ? (err as any).message.trim()
        : "请求失败";
    res.status(Number((err as any).statusCode) || 500).json({ ok: false, message });
    return;
  }

  res.status(500).json({ ok: false, message: "Internal Server Error" });
}
