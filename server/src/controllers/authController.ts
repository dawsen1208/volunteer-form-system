import type { NextFunction, Request, Response } from "express";

import { loginUser } from "../services/authService";

export async function loginUserController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const phone = String((req.body as { phone?: unknown } | undefined)?.phone ?? "");
    const password = String(
      (req.body as { password?: unknown } | undefined)?.password ?? ""
    );
    const result = await loginUser({ phone, password });
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

