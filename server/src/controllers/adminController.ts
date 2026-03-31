import type { NextFunction, Request, Response } from "express";

import { getAllForms, getFormByIdForAdmin } from "../services/adminService";
import { loginAdmin } from "../services/authService";

export async function loginAdminController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const password = String(
      (req.body as { password?: unknown } | undefined)?.password ?? ""
    );
    const result = await loginAdmin({ password });
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getAllFormsController(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const forms = await getAllForms();
    res.json({ ok: true, forms });
  } catch (err) {
    next(err);
  }
}

export async function getFormByIdForAdminController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const form = await getFormByIdForAdmin(req.params.id);
    res.json({ ok: true, form });
  } catch (err) {
    next(err);
  }
}
