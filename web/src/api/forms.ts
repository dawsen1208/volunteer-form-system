import { apiClient, unwrapOk } from "./client";

import type { FormContent, FormRecord, FormType } from "../types";

export async function createForm(type: FormType) {
  const res = await apiClient.post("/forms", { type });
  return unwrapOk<{ form: FormRecord }>(res.data).form;
}

export async function getMyForms() {
  const res = await apiClient.get("/my/forms");
  return unwrapOk<{ forms: FormRecord[] }>(res.data).forms;
}

export async function getMyFormById(id: string) {
  const res = await apiClient.get(`/my/forms/${id}`);
  return unwrapOk<{ form: FormRecord }>(res.data).form;
}

export async function updateMyForm(id: string, content: FormContent) {
  const res = await apiClient.put(`/my/forms/${id}`, { content });
  return unwrapOk<{ form: FormRecord }>(res.data).form;
}

export async function submitForm(id: string) {
  const res = await apiClient.post(`/forms/${id}/submit`);
  return unwrapOk<{ form: FormRecord }>(res.data).form;
}

export async function deleteMyDraft(id: string) {
  const res = await apiClient.delete(`/my/forms/${id}`);
  return unwrapOk<{ deleted: true }>(res.data);
}
