import { Button, message } from "antd";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { createForm, getMyForms } from "../api/forms";
import { AppCard } from "../components/AppCard";
import { DraftResumeModal } from "../components/DraftResumeModal";
import { PageHeader } from "../components/PageHeader";
import { MainLayout } from "../layouts/MainLayout";
import type { FormRecord, FormType } from "../types";
import { mapFormType } from "../utils/mapping";

export function FormTypePage() {
  const [api, contextHolder] = message.useMessage();
  const navigate = useNavigate();
  const [loadingType, setLoadingType] = useState<FormType | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingType, setPendingType] = useState<FormType | null>(null);
  const [draftForm, setDraftForm] = useState<FormRecord | null>(null);

  async function handlePick(type: FormType) {
    try {
      setLoadingType(type);
      const forms = await getMyForms();
      const draft =
        forms
          .filter((f) => f.type === type && f.status === "draft")
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0] ??
        null;

      if (draft) {
        setPendingType(type);
        setDraftForm(draft);
        setModalOpen(true);
        return;
      }

      const created = await createForm(type);
      navigate(`/form/${created.type}?id=${created._id}`, { replace: true });
    } catch (err: any) {
      api.error(err?.message || "操作失败");
    } finally {
      setLoadingType(null);
    }
  }

  async function handleRestart() {
    if (!pendingType) return;
    try {
      setLoadingType(pendingType);
      setModalOpen(false);
      const created = await createForm(pendingType);
      navigate(`/form/${created.type}?id=${created._id}`, { replace: true });
    } catch (err: any) {
      api.error(err?.message || "创建失败");
    } finally {
      setLoadingType(null);
      setPendingType(null);
      setDraftForm(null);
    }
  }

  function handleContinue() {
    if (!draftForm) return;
    setModalOpen(false);
    navigate(`/form/${draftForm.type}?id=${draftForm._id}`, { replace: true });
    setPendingType(null);
    setDraftForm(null);
  }

  return (
    <MainLayout title="选择志愿单类型">
      {contextHolder}
      <div className="space-y-6">
        <PageHeader
          title="选择志愿单类型"
          subtitle="请选择本科或专科志愿单类型进入填写"
          extra={<Button onClick={() => navigate("/profile")}>返回</Button>}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <AppCard className="flex flex-col gap-3">
            <div className="text-base font-semibold text-slate-900">本科志愿单</div>
            <div className="text-sm text-slate-600">适用于本科志愿填报。</div>
            <Button
              type="primary"
              loading={loadingType === "undergrad"}
              onClick={() => handlePick("undergrad")}
            >
              选择
            </Button>
          </AppCard>
          <AppCard className="flex flex-col gap-3">
            <div className="text-base font-semibold text-slate-900">专科志愿单</div>
            <div className="text-sm text-slate-600">适用于专科志愿填报。</div>
            <Button loading={loadingType === "junior"} onClick={() => handlePick("junior")}>
              选择
            </Button>
          </AppCard>
        </div>
      </div>

      <DraftResumeModal
        open={modalOpen}
        typeLabel={pendingType ? mapFormType(pendingType) : ""}
        onCancel={() => {
          setModalOpen(false);
          setPendingType(null);
          setDraftForm(null);
        }}
        onContinue={handleContinue}
        onRestart={handleRestart}
      />
    </MainLayout>
  );
}
