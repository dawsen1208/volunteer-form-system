import type { AuthRole } from "../types";

const KEYS = {
  token: "vfs.auth.token",
  role: "vfs.auth.role",
  userId: "vfs.auth.userId",
  phone: "vfs.auth.phone",
  lastLoginPath: "vfs.ui.lastLoginPath"
} as const;

export function getToken(): string | null {
  return localStorage.getItem(KEYS.token);
}

export function getRole(): AuthRole | null {
  const role = localStorage.getItem(KEYS.role);
  if (role === "user" || role === "admin") return role;
  return null;
}

export function getUserId(): string | null {
  return localStorage.getItem(KEYS.userId);
}

export function getPhone(): string | null {
  return localStorage.getItem(KEYS.phone);
}

export function setAuth(params: {
  token: string;
  role: AuthRole;
  userId?: string;
  phone?: string;
}): void {
  localStorage.setItem(KEYS.token, params.token);
  localStorage.setItem(KEYS.role, params.role);
  if (params.userId) localStorage.setItem(KEYS.userId, params.userId);
  else localStorage.removeItem(KEYS.userId);
  if (params.phone) localStorage.setItem(KEYS.phone, params.phone);
  else localStorage.removeItem(KEYS.phone);
}

export function clearAuth(): void {
  localStorage.removeItem(KEYS.token);
  localStorage.removeItem(KEYS.role);
  localStorage.removeItem(KEYS.userId);
  localStorage.removeItem(KEYS.phone);
}

export function getLastLoginPath(): string | null {
  const v = localStorage.getItem(KEYS.lastLoginPath);
  if (v === "/login" || v === "/login2" || v === "/admin-login") return v;
  return null;
}

export function setLastLoginPath(path: string): void {
  if (path === "/login" || path === "/login2" || path === "/admin-login") {
    localStorage.setItem(KEYS.lastLoginPath, path);
    return;
  }
  localStorage.removeItem(KEYS.lastLoginPath);
}
