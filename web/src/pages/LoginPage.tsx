import { Button, Form, Input, message } from "antd";
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
  const [form] = Form.useForm<Values>();

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
      bottom={<div className="text-center text-sm text-slate-600">宗老师 13779887445</div>}
    >
      {contextHolder}
      <Form layout="vertical" onFinish={onFinish} autoComplete="off" form={form}>
        <Form.Item label="手机号" name="phone" rules={[{ required: true }]}>
          <Input placeholder="请输入手机号" inputMode="numeric" />
        </Form.Item>
        <Form.Item label="密码" name="password" rules={[{ required: true }]}>
          <Input.Password placeholder="请输入密码" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block>
          登录 / 注册
        </Button>
        <div className="mt-4 flex flex-col gap-1 text-sm text-slate-600">
          <div>
            管理员请前往 <Link to="/admin-login">管理员登录</Link>
          </div>
          <div>
            新登录页请访问 <Link to="/login2">/login2</Link>
          </div>
        </div>
        <div className="mt-2 text-center text-xs text-slate-500">首次进入系统加载时间较长，请耐心等待</div>
      </Form>
    </AuthLayout>
  );
}
