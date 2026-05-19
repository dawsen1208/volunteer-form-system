import axios, { AxiosError } from "axios";

import type { ApiResponse } from "../types";
import { clearAuth, getPreferredLoginPath } from "../store/auth";
import { getToken } from "../utils/storage";

declare global {
  interface Window {
    __APP_CONFIG__?: {
      apiBaseUrl?: string;
      publicSiteUrl?: string;
    };
  }
}

const runtimeBaseURL =
  typeof window !== "undefined" ? (window.__APP_CONFIG__?.apiBaseUrl as string | undefined) : undefined;

const rawBaseURL = (runtimeBaseURL ?? (import.meta.env.VITE_API_BASE_URL as string | undefined)) as
  | string
  | undefined;
const baseURL = rawBaseURL && rawBaseURL.trim() ? rawBaseURL.trim() : undefined;
const fallbackBaseURL = import.meta.env.DEV ? "http://localhost:3001/api" : undefined;

export const apiClient = axios.create({
  baseURL: baseURL ?? fallbackBaseURL,
  timeout: 120000
});

apiClient.interceptors.request.use((config) => {
  if (!import.meta.env.DEV && !baseURL) {
    return Promise.reject(new Error("未配置 API 地址：请设置 VITE_API_BASE_URL 或 window.__APP_CONFIG__.apiBaseUrl"));
  }
  const token = getToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    const data = response.data as unknown;
    if (data && typeof data === "object" && "ok" in data) {
      const typed = data as ApiResponse<unknown> & Record<string, unknown>;
      if (typed.ok === false) {
        return Promise.reject(new Error(typed.message || "请求失败"));
      }
      return response;
    }
    return response;
  },
  (error: AxiosError) => {
    const status = error.response?.status;
    if (status === 401) {
      clearAuth();
      if (typeof window !== "undefined") {
        window.location.hash = `#${getPreferredLoginPath()}`;
      }
      return Promise.reject(new Error("登录已过期，请重新登录"));
    }
    const payload = error.response?.data as any;
    if (payload && typeof payload === "object" && typeof payload.message === "string") {
      return Promise.reject(new Error(payload.message));
    }
    return Promise.reject(new Error(error.message || "网络错误"));
  }
);

export function unwrapOk<T>(raw: any): T {
  if (raw && typeof raw === "object" && "ok" in raw) {
    if (raw.ok === true) {
      if ("data" in raw && raw.data !== undefined) return raw.data as T;
      const { ok, message, ...rest } = raw as Record<string, unknown>;
      return rest as T;
    }
    throw new Error(String(raw.message || "请求失败"));
  }
  return raw as T;
}
