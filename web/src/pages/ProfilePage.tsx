import { Button, Form, Input, Modal, message } from "antd";
import { FileTextOutlined, UnorderedListOutlined } from "@ant-design/icons";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { AppCard } from "../components/AppCard";
import { PageHeader } from "../components/PageHeader";
import { StatusTag } from "../components/StatusTag";
import { MainLayout } from "../layouts/MainLayout";
import { changeMyPassword } from "../api/auth";
import { getAuth } from "../store/auth";

export function ProfilePage() {
  const navigate = useNavigate();
  const auth = getAuth();
  const [api, contextHolder] = message.useMessage();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  async function submitChangePassword() {
    try {
      const values = await form.validateFields();
      const currentPassword = String(values.currentPassword ?? "");
      const newPassword = String(values.newPassword ?? "");
      const confirmPassword = String(values.confirmPassword ?? "");
      if (newPassword !== confirmPassword) {
        api.error("两次输入的新密码不一致");
        return;
      }
      setSaving(true);
      await changeMyPassword(currentPassword, newPassword);
      api.success("密码已修改");
      setOpen(false);
      form.resetFields();
    } catch (err: any) {
      if (err?.errorFields) return;
      api.error(err?.message || "修改失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <MainLayout title="个人中心">
      {contextHolder}
      <div className="space-y-6">
        <PageHeader
          title="个人中心"
          subtitle="可查看志愿单填写与提交记录"
          extra={
            auth?.role ? (
              <div className="flex items-center gap-2">
                <StatusTag kind="role" value={auth.role} />
                {auth.phone ? (
                  <span className="text-sm text-slate-600">{auth.phone}</span>
                ) : null}
                {auth.role === "user" ? (
                  <Button size="small" onClick={() => setOpen(true)}>
                    修改密码
                  </Button>
                ) : null}
              </div>
            ) : null
          }
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <AppCard className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-slate-900">
              <FileTextOutlined />
              <div className="text-base font-semibold">志愿单填写</div>
            </div>
            <div className="text-sm text-slate-600">
              选择志愿单类型，开始填写或继续完善草稿。
            </div>
            <div className="pt-1">
              <Button type="primary" onClick={() => navigate("/form-type")}>
                进入填写
              </Button>
            </div>
          </AppCard>

          <AppCard className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-slate-900">
              <UnorderedListOutlined />
              <div className="text-base font-semibold">我的提交记录</div>
            </div>
            <div className="text-sm text-slate-600">
              查看已提交或草稿中的志愿表单记录。
            </div>
            <div className="pt-1">
              <Button onClick={() => navigate("/records")}>查看记录</Button>
            </div>
          </AppCard>
        </div>
      </div>

      <Modal
        title="修改密码"
        open={open}
        onCancel={() => {
          if (saving) return;
          setOpen(false);
        }}
        onOk={submitChangePassword}
        okText="确认修改"
        cancelText="取消"
        confirmLoading={saving}
        destroyOnClose
      >
        <div className="space-y-3">
          <Form layout="vertical" form={form} autoComplete="off">
            <Form.Item
              label="原密码"
              name="currentPassword"
              rules={[{ required: true, message: "请输入原密码" }]}
            >
              <Input.Password placeholder="请输入原密码" />
            </Form.Item>
            <Form.Item
              label="新密码"
              name="newPassword"
              rules={[{ required: true, message: "请输入新密码" }]}
            >
              <Input.Password placeholder="请输入新密码（至少 4 位）" />
            </Form.Item>
            <Form.Item
              label="确认新密码"
              name="confirmPassword"
              dependencies={["newPassword"]}
              rules={[{ required: true, message: "请再次输入新密码" }]}
            >
              <Input.Password placeholder="请再次输入新密码" />
            </Form.Item>
          </Form>
        </div>
      </Modal>
    </MainLayout>
  );
}
