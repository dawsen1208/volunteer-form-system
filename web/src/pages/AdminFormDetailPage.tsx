import { Button, Descriptions, Popconfirm, Spin, message } from "antd";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { deleteAdminFormById, getAdminFormById } from "../api/admin";
import { AppCard } from "../components/AppCard";
import { FormContentView } from "../components/FormContentView";
import { FormSectionCard } from "../components/FormSectionCard";
import { PageHeader } from "../components/PageHeader";
import { StatusTag } from "../components/StatusTag";
import { MainLayout } from "../layouts/MainLayout";
import type { AdminFormRecord, FormContent } from "../types";
import { mapFormType } from "../utils/mapping";

function formatTime(value: string) {
  const t = new Date(value);
  if (Number.isNaN(t.getTime())) return value;
  return t.toLocaleString();
}

export function AdminFormDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [api, contextHolder] = message.useMessage();
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<AdminFormRecord | null>(null);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        setLoading(true);
        const data = await getAdminFormById(id);
        setForm(data);
      } catch (err: any) {
        api.error(err?.message || "加载失败");
        navigate("/admin", { replace: true });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [api, id, navigate]);

  const content = form?.content as FormContent | undefined;

  return (
    <MainLayout title="管理员后台">
      {contextHolder}
      <div className="space-y-6">
        <PageHeader
          title="表单详情"
          subtitle={form ? `${mapFormType(form.type)} · 更新时间 ${formatTime(form.updatedAt)}` : ""}
          extra={
            <div className="flex items-center gap-2">
              {form ? <StatusTag kind="status" value={form.status} /> : null}
              {form ? (
                <Popconfirm
                  title="确认删除该表单？"
                  description="删除后不可恢复。"
                  okText="删除"
                  okButtonProps={{ danger: true }}
                  cancelText="取消"
                  onConfirm={async () => {
                    if (!id) return;
                    try {
                      setLoading(true);
                      await deleteAdminFormById(id);
                      api.success("已删除");
                      navigate("/admin", { replace: true });
                    } catch (err: any) {
                      api.error(err?.message || "删除失败");
                      setLoading(false);
                    }
                  }}
                >
                  <Button danger>删除表单</Button>
                </Popconfirm>
              ) : null}
              <Button onClick={() => navigate("/admin")}>返回列表</Button>
            </div>
          }
        />

        {loading || !form ? (
          <AppCard>
            <div className="flex justify-center py-10">
              <Spin />
            </div>
          </AppCard>
        ) : (
          <div className="space-y-4">
            <FormSectionCard title="概览">
              <Descriptions size="small" column={2}>
                <Descriptions.Item label="用户手机号">
                  {form.userId?.phone ?? "-"}
                </Descriptions.Item>
                <Descriptions.Item label="表单类型">{mapFormType(form.type)}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <StatusTag kind="status" value={form.status} />
                </Descriptions.Item>
                <Descriptions.Item label="提交时间">
                  {form.submittedAt ? formatTime(form.submittedAt) : "-"}
                </Descriptions.Item>
              </Descriptions>
            </FormSectionCard>

            {content ? (
              <div className="space-y-4">
                <FormContentView type={form.type} content={content} />
              </div>
            ) : (
              <AppCard>
                <div className="text-sm text-slate-600">表单内容为空</div>
              </AppCard>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
