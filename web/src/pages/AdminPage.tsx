import { Button, Spin, Table, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getAdminForms } from "../api/admin";
import { AppCard } from "../components/AppCard";
import { PageHeader } from "../components/PageHeader";
import { StatusTag } from "../components/StatusTag";
import { MainLayout } from "../layouts/MainLayout";
import type { AdminFormRecord } from "../types";
import { mapFormType } from "../utils/mapping";

function formatTime(value: string) {
  const t = new Date(value);
  if (Number.isNaN(t.getTime())) return value;
  return t.toLocaleString();
}

export function AdminPage() {
  const navigate = useNavigate();
  const [api, contextHolder] = message.useMessage();
  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState<AdminFormRecord[]>([]);

  async function load() {
    try {
      setLoading(true);
      const list = await getAdminForms();
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

  const columns = useMemo<ColumnsType<AdminFormRecord>>(
    () => [
      {
        title: "用户手机号",
        dataIndex: ["userId", "phone"],
        render: (_v, record) => record.userId?.phone ?? "-"
      },
      {
        title: "表单类型",
        dataIndex: "type",
        render: (v) => mapFormType(v)
      },
      {
        title: "状态",
        dataIndex: "status",
        render: (v) => <StatusTag kind="status" value={v} />
      },
      {
        title: "更新时间",
        dataIndex: "updatedAt",
        render: (v) => formatTime(v)
      },
      {
        title: "提交时间",
        dataIndex: "submittedAt",
        render: (v) => (v ? formatTime(v) : "-")
      },
      {
        title: "操作",
        key: "action",
        render: (_v, record) => (
          <Button type="link" onClick={() => navigate(`/admin/forms/${record._id}`)}>
            查看详情
          </Button>
        )
      }
    ],
    [navigate]
  );

  return (
    <MainLayout title="管理员后台">
      {contextHolder}
      <div className="space-y-6">
        <PageHeader
          title="管理员后台"
          subtitle="可查看用户提交的志愿表单"
          extra={
            <div className="flex items-center gap-2">
              <StatusTag kind="role" value="admin" />
              <Button onClick={load}>刷新</Button>
            </div>
          }
        />
        <AppCard>
          {loading ? (
            <div className="flex justify-center py-10">
              <Spin />
            </div>
          ) : (
            <Table rowKey="_id" dataSource={forms} columns={columns} pagination={{ pageSize: 10 }} />
          )}
        </AppCard>
      </div>
    </MainLayout>
  );
}
