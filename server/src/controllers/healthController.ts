import type { Request, Response } from "express";

export function healthzController(_req: Request, res: Response): void {
  res.json({ ok: true, message: "ok" });
}

