import type { AuthRole } from "../types";
import { clearAuth as clearAuthStorage, getPhone, getRole, getToken, getUserId, setAuth as setAuthStorage } from "../utils/storage";

function decodeJwtPayload(token: string): any {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = decodeURIComponent(
      Array.from(atob(padded))
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function getAuth() {
  const token = getToken();
  const role = getRole();
  const userId = getUserId();
  const phone = getPhone();
  if (!token || !role) return null;
  return { token, role, userId: userId ?? undefined, phone: phone ?? undefined };
}

export function setAuth(params: { token: string; role: AuthRole }): void {
  const payload = decodeJwtPayload(params.token);
  const userId = typeof payload?.userId === "string" ? payload.userId : undefined;
  const phone = typeof payload?.phone === "string" ? payload.phone : undefined;
  setAuthStorage({ token: params.token, role: params.role, userId, phone });
}

export function clearAuth(): void {
  clearAuthStorage();
}

export function isLoggedIn(): boolean {
  return Boolean(getToken() && getRole());
}

export function isAdmin(): boolean {
  return getRole() === "admin";
}

export function isUser(): boolean {
  return getRole() === "user";
}

