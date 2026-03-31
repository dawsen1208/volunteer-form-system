import axios, { AxiosError } from "axios";

import type { ApiResponse } from "../types";
import { getToken } from "../utils/storage";

const rawBaseURL = import.meta.env.VITE_API_BASE_URL as string | undefined;
const baseURL = rawBaseURL && rawBaseURL.trim() ? rawBaseURL.trim() : undefined;
const fallbackBaseURL = import.meta.env.DEV ? "http://localhost:3001/api" : "/api";

export const apiClient = axios.create({
  baseURL: baseURL ?? fallbackBaseURL,
  timeout: 15000
});

apiClient.interceptors.request.use((config) => {
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
