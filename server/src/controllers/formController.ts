import type { NextFunction, Request, Response } from "express";

import { AppError } from "../utils/errors";
import { createForm, submitForm } from "../services/formService";

export async function createFormController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }
    if (req.user.role !== "user" || !req.user.userId) {
      throw new AppError(403, "Forbidden");
    }
    const type = String((req.body as { type?: unknown } | undefined)?.type ?? "");
    const form = await createForm(req.user.userId, type as any);
    res.json({ ok: true, form });
  } catch (err) {
    next(err);
  }
}

export async function submitFormController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }
    if (req.user.role !== "user" || !req.user.userId) {
      throw new AppError(403, "Forbidden");
    }
    const formId = req.params.id;
    const form = await submitForm(req.user.userId, formId);
    res.json({ ok: true, form });
  } catch (err) {
    next(err);
  }
}
