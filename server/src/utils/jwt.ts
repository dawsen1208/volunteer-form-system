import jwt from "jsonwebtoken";

import { env } from "../config/env";
import { AppError } from "./errors";

export type Role = "user" | "admin";

export type AuthTokenPayload = {
  role: Role;
  userId?: string;
  phone?: string;
};

export function signAuthToken(payload: AuthTokenPayload): string {
  const options: jwt.SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"]
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded !== "object" || decoded === null) {
      throw new AppError(401, "Unauthorized");
    }
    const role = (decoded as { role?: unknown }).role;
    const userId = (decoded as { userId?: unknown }).userId;
    const phone = (decoded as { phone?: unknown }).phone;
    if (role !== "user" && role !== "admin") {
      throw new AppError(401, "Unauthorized");
    }
    return {
      role,
      userId: typeof userId === "string" ? userId : undefined,
      phone: typeof phone === "string" ? phone : undefined
    };
  } catch {
    throw new AppError(401, "Unauthorized");
  }
}
