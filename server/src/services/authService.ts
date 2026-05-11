import crypto from "crypto";

import mongoose from "mongoose";

import { env } from "../config/env";
import { FormModel } from "../models/Form";
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

export async function changeUserPasswordAndClearForms(params: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<{ clearedCount: number }> {
  const userId = params.userId;
  const currentPassword = params.currentPassword;
  const newPassword = params.newPassword;

  if (!mongoose.isValidObjectId(userId)) {
    throw new AppError(401, "Unauthorized");
  }
  if (!currentPassword || !newPassword) {
    throw new AppError(400, "密码不能为空");
  }
  if (newPassword.length < 4) {
    throw new AppError(400, "新密码至少 4 位");
  }

  const user = await UserModel.findById(userId).exec();
  if (!user) {
    throw new AppError(404, "用户不存在");
  }

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) {
    throw new AppError(401, "原密码错误");
  }

  const passwordHash = await hashPassword(newPassword);

  let clearedCount = 0;
  try {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await UserModel.updateOne({ _id: userId }, { $set: { passwordHash } }, { session }).exec();
        const deleted = await FormModel.deleteMany({ userId }, { session }).exec();
        clearedCount = deleted.deletedCount ?? 0;
      });
      return { clearedCount };
    } finally {
      await session.endSession();
    }
  } catch (err: any) {
    const msg = String(err?.message ?? "");
    if (!/transaction/i.test(msg)) {
      throw err;
    }
  }

  await UserModel.updateOne({ _id: userId }, { $set: { passwordHash } }).exec();
  const deleted = await FormModel.deleteMany({ userId }).exec();
  clearedCount = deleted.deletedCount ?? 0;
  return { clearedCount };
}

export async function changeUserPassword(params: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<{ changed: true }> {
  const userId = params.userId;
  const currentPassword = params.currentPassword;
  const newPassword = params.newPassword;

  if (!mongoose.isValidObjectId(userId)) {
    throw new AppError(401, "Unauthorized");
  }
  if (!currentPassword || !newPassword) {
    throw new AppError(400, "密码不能为空");
  }
  if (newPassword.length < 4) {
    throw new AppError(400, "新密码至少 4 位");
  }

  const user = await UserModel.findById(userId).exec();
  if (!user) {
    throw new AppError(404, "用户不存在");
  }

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) {
    throw new AppError(401, "原密码错误");
  }

  const passwordHash = await hashPassword(newPassword);
  await UserModel.updateOne({ _id: userId }, { $set: { passwordHash } }).exec();
  return { changed: true };
}

export async function resetPasswordAndClearFormsByPhone(params: {
  phone: string;
  newPassword: string;
}): Promise<{ clearedCount: number; isNew: boolean }> {
  const phone = params.phone.trim();
  const newPassword = params.newPassword;

  if (!/^1\\d{10}$/.test(phone)) {
    throw new AppError(400, "手机号格式不正确");
  }
  if (!newPassword) {
    throw new AppError(400, "密码不能为空");
  }
  if (newPassword.length < 4) {
    throw new AppError(400, "新密码至少 4 位");
  }

  const existing = await UserModel.findOne({ phone }).exec();
  if (!existing) {
    const passwordHash = await hashPassword(newPassword);
    await UserModel.create({ phone, passwordHash });
    return { clearedCount: 0, isNew: true };
  }

  const passwordHash = await hashPassword(newPassword);
  const userId = existing._id.toString();

  let clearedCount = 0;
  try {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await UserModel.updateOne({ _id: existing._id }, { $set: { passwordHash } }, { session }).exec();
        const deleted = await FormModel.deleteMany({ userId: existing._id }, { session }).exec();
        clearedCount = deleted.deletedCount ?? 0;
      });
      return { clearedCount, isNew: false };
    } finally {
      await session.endSession();
    }
  } catch (err: any) {
    const msg = String(err?.message ?? "");
    if (!/transaction/i.test(msg)) {
      throw err;
    }
  }

  await UserModel.updateOne({ _id: existing._id }, { $set: { passwordHash } }).exec();
  const deleted = await FormModel.deleteMany({ userId: existing._id }).exec();
  clearedCount = deleted.deletedCount ?? 0;
  return { clearedCount, isNew: false };
}
