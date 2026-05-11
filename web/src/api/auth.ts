import { apiClient, unwrapOk } from "./client";

import type { LoginResponse } from "../types";

export async function loginUser(phone: string, password: string) {
  const res = await apiClient.post("/auth/login", { phone, password });
  return unwrapOk<LoginResponse>(res.data);
}

export async function loginAdmin(password: string) {
  const res = await apiClient.post("/admin/login", { password });
  return unwrapOk<LoginResponse>(res.data);
}

export async function changeMyPassword(currentPassword: string, newPassword: string) {
  const res = await apiClient.put("/my/password", { currentPassword, newPassword });
  return unwrapOk<{ changed: true }>(res.data);
}

export async function resetPassword(phone: string, newPassword: string) {
  const res = await apiClient.post("/auth/reset-password", { phone, newPassword });
  return unwrapOk<{ clearedCount: number; isNew: boolean }>(res.data);
}
