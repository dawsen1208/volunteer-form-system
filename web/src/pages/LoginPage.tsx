import { Button, Form, Input, QRCode, message } from "antd";
import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

import { loginUser } from "../api/auth";
import { AuthLayout } from "../layouts/AuthLayout";
import { getAuth, setAuth } from "../store/auth";

type Values = {
  phone: string;
  password: string;
};

export function LoginPage() {
  const navigate = useNavigate();
  const [api, contextHolder] = message.useMessage();
  const publicUrl = "https://volunteerformapp.z1.web.core.windows.net/";

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
        </div>
      }
    >
      {contextHolder}
      <Form layout="vertical" onFinish={onFinish} autoComplete="off">
        <Form.Item label="手机号" name="phone" rules={[{ required: true }]}>
          <Input placeholder="请输入手机号" inputMode="numeric" />
        </Form.Item>
        <Form.Item label="密码" name="password" rules={[{ required: true }]}>
          <Input.Password placeholder="请输入密码" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block>
          登录 / 注册
        </Button>
        <div className="mt-4 text-sm text-slate-600">
          管理员请前往 <Link to="/admin-login">管理员登录</Link>
        </div>
      </Form>
    </AuthLayout>
  );
}
