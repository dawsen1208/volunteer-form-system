import { Alert, Button, Form, Input, Modal, QRCode, message } from "antd";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { loginUser, resetPassword } from "../api/auth";
import { AuthLayout } from "../layouts/AuthLayout";
import { getAuth, setAuth } from "../store/auth";

type Values = {
  phone: string;
  password: string;
};

export function LoginPage() {
  const navigate = useNavigate();
  const [api, contextHolder] = message.useMessage();
  const [form] = Form.useForm<Values>();
  const [resetForm] = Form.useForm<{
    phone: string;
    newPassword: string;
    confirmPassword: string;
  }>();
  const [resetOpen, setResetOpen] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const rawPublicUrl =
    (typeof window !== "undefined" ? window.__APP_CONFIG__?.publicSiteUrl : undefined) ??
    (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined);
  const publicUrl = (() => {
    const candidate = rawPublicUrl && rawPublicUrl.trim() ? rawPublicUrl.trim() : "";
    if (candidate) {
      try {
        const u = new URL(candidate);
        return u.hash ? candidate : `${u.origin}/#/login`;
      } catch {
        const cleaned = candidate.replace(/\/+$/, "");
        return cleaned.includes("#") ? cleaned : `${cleaned}/#/login`;
      }
    }
    return `${window.location.origin}/#/login`;
  })();

  useEffect(() => {
    const auth = getAuth();
    if (!auth) return;
    if (auth.role === "admin") navigate("/admin", { replace: true });
    else navigate("/profile", { replace: true });
  }, [navigate]);

  async function onFinish(values: Values) {
    const phone = values.phone.trim();
    const password = values.password;
    if (!phone) {
      api.error("手机号不能为空");
      return;
    }
    if (!password) {
      api.error("密码不能为空");
      return;
    }
    if (!/^1\d{10}$/.test(phone)) {
      api.error("手机号格式不正确");
      return;
    }

    try {
      const data = await loginUser(phone, password);
      setAuth({ token: data.token, role: "user" });
      navigate("/profile", { replace: true });
    } catch (err: any) {
      api.error(err?.message || "登录失败");
    }
  }

  function openResetPassword() {
    const phone = String(form.getFieldValue("phone") ?? "").trim();
    resetForm.setFieldsValue({ phone });
    setResetOpen(true);
  }

  async function submitResetPassword() {
    try {
      const values = await resetForm.validateFields();
      const phone = String(values.phone ?? "").trim();
      const newPassword = String(values.newPassword ?? "");
      const confirmPassword = String(values.confirmPassword ?? "");
      if (!/^1\d{10}$/.test(phone)) {
        api.error("手机号格式不正确");
        return;
      }
      if (newPassword.length < 4) {
        api.error("新密码至少 4 位");
        return;
      }
      if (newPassword !== confirmPassword) {
        api.error("两次输入的新密码不一致");
        return;
      }
      setResetLoading(true);
      const result = await resetPassword(phone, newPassword);
      api.success(
        result.isNew
          ? "已设置密码，请使用手机号和新密码登录"
          : `已重置密码，已清空 ${result.clearedCount} 条填写记录，请使用手机号和新密码登录`
      );
      setResetOpen(false);
      resetForm.resetFields();
    } catch (err: any) {
      if (err?.errorFields) return;
      api.error(err?.message || "重置失败");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <AuthLayout
      title="用户登录"
      subtitle="首次输入手机号和密码会自动注册并直接登录"
      bottom={
        <div className="flex flex-col items-center gap-2">
          <div className="text-sm font-medium text-slate-900">打开线上站点</div>
          <QRCode value={publicUrl} size={160} />
          <a
            className="text-xs text-slate-600 underline"
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
          >
            {publicUrl}
          </a>
          <div className="text-xs text-slate-500">首次进入系统加载时间较长，请耐心等待</div>
        </div>
      }
    >
      {contextHolder}
      <Form layout="vertical" onFinish={onFinish} autoComplete="off" form={form}>
        <Form.Item label="手机号" name="phone" rules={[{ required: true }]}>
          <Input placeholder="请输入手机号" inputMode="numeric" />
        </Form.Item>
        <Form.Item label="密码" name="password" rules={[{ required: true }]}>
          <Input.Password placeholder="请输入密码" />
        </Form.Item>
        <div className="-mt-2 mb-2 flex justify-end">
          <Button type="link" size="small" onClick={openResetPassword}>
            忘记密码
          </Button>
        </div>
        <Button type="primary" htmlType="submit" block>
          登录 / 注册
        </Button>
        <div className="mt-4 text-sm text-slate-600">
          管理员请前往 <Link to="/admin-login">管理员登录</Link>
        </div>
      </Form>

      <Modal
        title="忘记密码"
        open={resetOpen}
        onCancel={() => {
          if (resetLoading) return;
          setResetOpen(false);
        }}
        onOk={submitResetPassword}
        okText="重置密码"
        cancelText="取消"
        confirmLoading={resetLoading}
        destroyOnClose
      >
        <div className="space-y-3">
          <Alert
            type="warning"
            showIcon
            message="可以为这个手机号重新设置密码，但会清除该手机号原有的填写记录（草稿/已提交），不可恢复。"
          />
          <Form layout="vertical" form={resetForm} autoComplete="off">
            <Form.Item
              label="手机号"
              name="phone"
              rules={[{ required: true, message: "请输入手机号" }]}
            >
              <Input placeholder="请输入手机号" inputMode="numeric" />
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
    </AuthLayout>
  );
}
