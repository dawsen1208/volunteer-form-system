import type { NextFunction, Request, Response } from "express";

import { loginUser, resetPasswordAndClearFormsByPhone } from "../services/authService";

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

export async function resetPasswordController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const phone = String((req.body as { phone?: unknown } | undefined)?.phone ?? "");
    const newPassword = String(
      (req.body as { newPassword?: unknown } | undefined)?.newPassword ?? ""
    );
    const result = await resetPasswordAndClearFormsByPhone({ phone, newPassword });
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}
