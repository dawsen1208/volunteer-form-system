import { Alert, Button, Descriptions, Modal, Popconfirm, Spin, Table, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { deleteAdminFormById, getAdminFormById } from "../api/admin";
import { apiClient } from "../api/client";
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

async function pollRecommendationReady(formId: string, maxMs: number) {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    const res = await apiClient.get(`/recommendations/${formId}`);
    const data = res.data as any;
    if (data && data.ok === true && data.status === "done" && data.result && Array.isArray(data.result.items)) {
      return data.result.items as any[];
    }
    if (data && data.ok === true && data.status === "failed" && typeof data.message === "string") {
      throw new Error(data.message);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  return null;
}

export function AdminFormDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [api, contextHolder] = message.useMessage();
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<AdminFormRecord | null>(null);
  const [recOpen, setRecOpen] = useState(false);
  const [recLoading, setRecLoading] = useState(false);
  const [recItems, setRecItems] = useState<any[]>([]);
  const [recError, setRecError] = useState<string>("");

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

  const recColumns: ColumnsType<any> = [
    { title: "学校", dataIndex: "school" },
    { title: "专业", dataIndex: "major" },
    { title: "最低分", dataIndex: "minScore" },
    { title: "分差(用户-最低)", dataIndex: "scoreGap" },
    { title: "最低位次", dataIndex: "minRank" },
    { title: "位次差(用户-最低)", dataIndex: "rankGap" },
    { title: "匹配度", dataIndex: "matchScore" }
  ];

  async function refreshForm() {
    if (!id) return;
    const data = await getAdminFormById(id);
    setForm(data);
  }

  async function startRecommendation() {
    if (!id || !content) return;
    try {
      setLoading(true);
      await apiClient.post("/recommendations", { formId: id, content });
      api.success("已开始生成推荐，请稍后点击“查看推荐”");
      await refreshForm();
    } catch (err: any) {
      api.error(err?.message || "开始生成推荐失败");
    } finally {
      setLoading(false);
    }
  }

  async function openRecommendation() {
    if (!id) return;
    try {
      setRecLoading(true);
      setRecError("");
      const res = await apiClient.get(`/recommendations/${id}`);
      const data = res.data as any;
      if (data && data.ok === true && data.status === "done" && data.result && Array.isArray(data.result.items)) {
        setRecItems(data.result.items);
        setRecOpen(true);
        return;
      }
      if (data && data.ok === true && data.status === "pending") {
        api.info("推荐生成中，请稍后再试");
        return;
      }
      if (data && data.ok === true && data.status === "failed" && typeof data.message === "string") {
        api.error(data.message);
        return;
      }
      api.info("暂无推荐结果，请先生成推荐");
    } catch (err: any) {
      api.error(err?.message || "获取推荐失败");
    } finally {
      setRecLoading(false);
    }
  }

  async function testRecommendationSync() {
    if (!id) return;
    if (!content) {
      api.error("表单内容为空，无法测试推荐");
      return;
    }
    try {
      setRecLoading(true);
      setRecError("");
      setRecItems([]);
      setRecOpen(true);
      api.open({ type: "loading", content: "正在生成推荐…", duration: 0, key: "rec-test" });

      await apiClient.post("/recommendations", { formId: id, content });
      const items = await pollRecommendationReady(id, 10 * 60 * 1000);
      if (!items || !items.length) throw new Error("推荐生成超时，请稍后重试");

      setRecItems(items);
      api.open({ type: "success", content: `推荐已生成：${items.length} 条`, key: "rec-test" });
    } catch (err: any) {
      const msg = err?.message || "推荐测试失败";
      setRecError(String(msg));
      api.open({ type: "error", content: String(msg), key: "rec-test" });
    } finally {
      setRecLoading(false);
    }
  }

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
                <Button loading={recLoading} onClick={openRecommendation}>
                  查看推荐
                </Button>
              ) : null}
              {form ? (
                <Button disabled={!content} loading={recLoading} onClick={testRecommendationSync}>
                  测试推荐
                </Button>
              ) : null}
              {form ? (
                <Button disabled={!content} onClick={startRecommendation}>
                  生成推荐
                </Button>
              ) : null}
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

      <Modal
        title="推荐结果"
        open={recOpen}
        onCancel={() => setRecOpen(false)}
        footer={null}
        width={900}
      >
        <Alert
          type="warning"
          showIcon
          message="推荐功能声明"
          description="本推荐功能仅用于提供志愿填报建议，不包含录取预测功能；参与分析的所有数据均为往年数据，不保证推荐学校在当年一定能录取。"
          className="mb-3"
        />
        {recError ? (
          <Alert type="error" showIcon message="推荐生成失败" description={recError} />
        ) : recLoading ? (
          <div className="flex justify-center py-8">
            <Spin />
          </div>
        ) : recItems.length ? (
          <Table
            rowKey={(r) => r.code ?? `${r.school ?? ""}-${r.major ?? ""}`}
            dataSource={recItems}
            pagination={{ pageSize: 10 }}
            columns={recColumns}
          />
        ) : (
          <div className="text-sm text-slate-600">暂无推荐结果</div>
        )}
      </Modal>
    </MainLayout>
  );
}
