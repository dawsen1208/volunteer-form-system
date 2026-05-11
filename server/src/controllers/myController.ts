import type { NextFunction, Request, Response } from "express";

import { AppError } from "../utils/errors";
import {
  deleteMyDraft,
  getMyFormById,
  getMyForms,
  updateMyForm
} from "../services/formService";
import { changeUserPasswordAndClearForms } from "../services/authService";

function requireUserId(req: Request): string {
  if (!req.user) {
    throw new AppError(401, "Unauthorized");
  }
  if (req.user.role !== "user" || !req.user.userId) {
    throw new AppError(403, "Forbidden");
  }
  return req.user.userId;
}

export async function getMyFormsController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = requireUserId(req);
    const forms = await getMyForms(userId);
    res.json({ ok: true, forms });
  } catch (err) {
    next(err);
  }
}

export async function getMyFormByIdController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = requireUserId(req);
    const form = await getMyFormById(userId, req.params.id);
    res.json({ ok: true, form });
  } catch (err) {
    next(err);
  }
}

export async function updateMyFormController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = requireUserId(req);
    const content = (req.body as { content?: unknown } | undefined)?.content;
    if (content === undefined) {
      throw new AppError(400, "Invalid input");
    }
    const form = await updateMyForm(userId, req.params.id, content as Record<string, any>);
    res.json({ ok: true, form });
  } catch (err) {
    next(err);
  }
}

export async function deleteMyDraftController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = requireUserId(req);
    const result = await deleteMyDraft(userId, req.params.id);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function changeMyPasswordController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = requireUserId(req);
    const currentPassword = String(
      (req.body as { currentPassword?: unknown } | undefined)?.currentPassword ?? ""
    );
    const newPassword = String(
      (req.body as { newPassword?: unknown } | undefined)?.newPassword ?? ""
    );
    const result = await changeUserPasswordAndClearForms({
      userId,
      currentPassword,
      newPassword
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}
