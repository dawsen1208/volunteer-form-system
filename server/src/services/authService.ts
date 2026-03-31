import crypto from "crypto";

import { env } from "../config/env";
import { UserModel } from "../models/User";
import { AppError } from "../utils/errors";
import { signAuthToken } from "../utils/jwt";
import { hashPassword, verifyPassword } from "../utils/password";

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export async function loginUser(params: {
  phone: string;
  password: string;
}): Promise<{ token: string; role: "user"; isNew: boolean }> {
  const phone = params.phone.trim();
  const password = params.password;

  if (!phone || !password) {
    throw new AppError(400, "Invalid input");
  }

  const existing = await UserModel.findOne({ phone }).exec();
  if (!existing) {
    const passwordHash = await hashPassword(password);
    const created = await UserModel.create({ phone, passwordHash });
    const token = signAuthToken({
      role: "user",
      userId: created._id.toString(),
      phone: created.phone
    });
    return { token, role: "user", isNew: true };
  }

  const ok = await verifyPassword(password, existing.passwordHash);
  if (!ok) {
    throw new AppError(401, "手机号或密码错误");
  }

  const token = signAuthToken({
    role: "user",
    userId: existing._id.toString(),
    phone: existing.phone
  });
  return { token, role: "user", isNew: false };
}

export async function loginAdmin(params: {
  password: string;
}): Promise<{ token: string; role: "admin" }> {
  const password = params.password;
  if (!password) {
    throw new AppError(400, "Invalid input");
  }

  if (!safeEqual(password, env.ADMIN_PASSWORD)) {
    throw new AppError(401, "密码错误");
  }

  const token = signAuthToken({ role: "admin" });
  return { token, role: "admin" };
}
