import crypto from "crypto";

import { env } from "../config/env";
import { UserModel } from "../models/User";
import { AppError } from "../utils/errors";
import { signAuthToken } from "../utils/jwt";
import { decryptPassword, encryptPassword, hashPassword, verifyPassword } from "../utils/password";

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

const ADMIN_PASSWORD_ALLOWLIST = ["13396216040", "13779887445"] as const;

function isAdminPasswordInAllowlist(password: string): boolean {
  return ADMIN_PASSWORD_ALLOWLIST.some((p) => safeEqual(password, p));
}

function assertAdminPassword(password: string): void {
  const ok =
    safeEqual(password, env.ADMIN_PASSWORD) ||
    isAdminPasswordInAllowlist(password);
  if (!ok) {
    throw new AppError(401, "密码错误");
  }
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
    const enc = encryptPassword(password);
    const created = await UserModel.create({
      phone,
      passwordHash,
      passwordCipherText: enc.cipherText,
      passwordIv: enc.iv,
      passwordTag: enc.tag
    });
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

  if (!existing.passwordCipherText || !existing.passwordIv || !existing.passwordTag) {
    const enc = encryptPassword(password);
    await UserModel.updateOne(
      { _id: existing._id },
      {
        $set: {
          passwordCipherText: enc.cipherText,
          passwordIv: enc.iv,
          passwordTag: enc.tag
        }
      }
    ).exec();
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
  const password = params.password.trim();
  if (!password) {
    throw new AppError(400, "Invalid input");
  }

  assertAdminPassword(password);

  const token = signAuthToken({ role: "admin" });
  return { token, role: "admin" };
}

export async function getUserPasswordForAdmin(params: {
  phone: string;
  adminPassword: string;
}): Promise<{ password: string }> {
  const phone = params.phone.trim();
  const adminPassword = params.adminPassword.trim();
  if (!/^1\d{10}$/.test(phone)) {
    throw new AppError(400, "手机号格式不正确");
  }
  if (!adminPassword) {
    throw new AppError(400, "Invalid input");
  }
  assertAdminPassword(adminPassword);

  const user = await UserModel.findOne({ phone }).exec();
  if (!user) {
    throw new AppError(404, "用户不存在");
  }
  if (!user.passwordCipherText || !user.passwordIv || !user.passwordTag) {
    throw new AppError(404, "未记录密码");
  }
  let password = "";
  try {
    password = decryptPassword({
      cipherText: user.passwordCipherText,
      iv: user.passwordIv,
      tag: user.passwordTag
    });
  } catch {
    throw new AppError(500, "密码解密失败");
  }
  return { password };
}
