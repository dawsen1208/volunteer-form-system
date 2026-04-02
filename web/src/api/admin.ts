import { apiClient, unwrapOk } from "./client";

import type { AdminFormRecord } from "../types";

export async function getAdminForms() {
  const res = await apiClient.get("/admin/forms");
  return unwrapOk<{ forms: AdminFormRecord[] }>(res.data).forms;
}

export async function getAdminFormById(id: string) {
  const res = await apiClient.get(`/admin/forms/${id}`);
  return unwrapOk<{ form: AdminFormRecord }>(res.data).form;
}

export async function deleteAdminFormById(id: string) {
  const res = await apiClient.delete(`/admin/forms/${id}`);
  return unwrapOk<{ deleted: boolean }>(res.data).deleted;
}
