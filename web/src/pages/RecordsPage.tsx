import { Button, Empty, Popconfirm, Select, Spin, message } from "antd";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { deleteMyDraft, getMyForms } from "../api/forms";
import { AppCard } from "../components/AppCard";
import { PageHeader } from "../components/PageHeader";
import { StatusTag } from "../components/StatusTag";
import { MainLayout } from "../layouts/MainLayout";
import type { FormRecord, FormStatus, FormType } from "../types";
import { mapFormType } from "../utils/mapping";

function formatTime(value: string) {
  const t = new Date(value);
  if (Number.isNaN(t.getTime())) return value;
  return t.toLocaleString();
}

export function RecordsPage() {
  const navigate = useNavigate();
  const [api, contextHolder] = message.useMessage();
  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState<FormRecord[]>([]);
  const [typeFilter, setTypeFilter] = useState<FormType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<FormStatus | "all">("all");

  async function load() {
    try {
      setLoading(true);
      const list = await getMyForms();
      setForms(list);
    } catch (err: any) {
      api.error(err?.message || "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = forms.filter((f) => {
    if (typeFilter !== "all" && f.type !== typeFilter) return false;
    if (statusFilter !== "all" && f.status !== statusFilter) return false;
    return true;
  });

  const drafts = filtered
    .filter((f) => f.status === "draft")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const submitted = filtered
    .filter((f) => f.status === "submitted")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return (
    <MainLayout title="我的提交记录">
      {contextHolder}
      <div className="space-y-6">
        <PageHeader
          title="我的提交记录"
          subtitle="查看草稿与已提交的志愿表单"
          extra={
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => navigate("/profile")}>返回</Button>
              <Select
                value={typeFilter}
                style={{ width: 140 }}
                options={[
                  { label: "全部类型", value: "all" },
                  { label: "本科志愿单", value: "undergrad" },
                  { label: "专科志愿单", value: "junior" }
                ]}
                onChange={(v) => setTypeFilter(v)}
              />
              <Select
                value={statusFilter}
                style={{ width: 120 }}
                options={[
                  { label: "全部状态", value: "all" },
                  { label: "草稿", value: "draft" },
                  { label: "已提交", value: "submitted" }
                ]}
                onChange={(v) => setStatusFilter(v)}
              />
              <Button onClick={load}>刷新</Button>
            </div>
          }
        />

        {loading ? (
          <AppCard>
            <div className="flex justify-center py-10">
              <Spin />
            </div>
          </AppCard>
        ) : forms.length === 0 ? (
          <AppCard>
            <Empty description="暂无记录" />
            <div className="mt-4 flex justify-center">
              <Button type="primary" onClick={() => navigate("/form-type")}>
                去填写志愿单
              </Button>
            </div>
          </AppCard>
        ) : filtered.length === 0 ? (
          <AppCard>
            <Empty description="当前筛选条件下暂无记录" />
            <div className="mt-4 flex justify-center">
              <Button
                onClick={() => {
                  setTypeFilter("all");
                  setStatusFilter("all");
                }}
              >
                清空筛选
              </Button>
            </div>
          </AppCard>
        ) : (
          <>
          <div className="space-y-4">
            {drafts.length ? (
              <div className="space-y-3">
                <div className="text-sm font-semibold text-slate-900">
                  草稿（{drafts.length}）
                </div>
                {drafts.map((f) => (
                  <AppCard key={f._id} className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-base font-semibold text-slate-900">
                          {mapFormType(f.type)}
                        </div>
                        <div className="text-xs text-slate-500">
                          更新时间：{formatTime(f.updatedAt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusTag kind="status" value={f.status} />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="primary"
                        onClick={() => navigate(`/form/${f.type}?id=${f._id}`)}
                      >
                        继续编辑
                      </Button>
                      <Button onClick={() => navigate(`/form/${f.type}?id=${f._id}`)}>
                        查看详情
                      </Button>
                      <Popconfirm
                        title="确认删除草稿？"
                        description="仅会删除该草稿，已提交表单无法删除。"
                        okText="删除"
                        cancelText="取消"
                        onConfirm={async () => {
                          try {
                            await deleteMyDraft(f._id);
                            api.success("草稿已删除");
                            await load();
                          } catch (err: any) {
                            api.error(err?.message || "删除失败");
                          }
                        }}
                      >
                        <Button danger>删除草稿</Button>
                      </Popconfirm>
                    </div>
                  </AppCard>
                ))}
              </div>
            ) : null}

            {submitted.length ? (
              <div className="space-y-3">
                <div className="text-sm font-semibold text-slate-900">
                  已提交（{submitted.length}）
                </div>
                {submitted.map((f) => (
                  <AppCard key={f._id} className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-base font-semibold text-slate-900">
                          {mapFormType(f.type)}
                        </div>
                        <div className="text-xs text-slate-500">
                          更新时间：{formatTime(f.updatedAt)}
                        </div>
                        {f.submittedAt ? (
                          <div className="text-xs text-slate-500">
                            提交时间：{formatTime(f.submittedAt)}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusTag kind="status" value={f.status} />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button onClick={() => navigate(`/form/${f.type}?id=${f._id}`)}>
                        查看详情
                      </Button>
                    </div>
                  </AppCard>
                ))}
              </div>
            ) : null}
          </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
