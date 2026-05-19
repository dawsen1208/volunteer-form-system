import { Button, Form, Input, QRCode, message } from "antd";
import { useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";

import { QrCode } from "@rc-component/qrcode/es/libs/qrcodegen";
import { ERROR_LEVEL_MAP } from "@rc-component/qrcode/es/utils";

import { loginUser } from "../api/auth";
import { AuthLayout } from "../layouts/AuthLayout";
import { getAuth, setAuth } from "../store/auth";

type Values = {
  phone: string;
  password: string;
};

function BrandHeader(props: { size?: number }) {
  const size = props.size ?? 44;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <svg
          width={size}
          height={size}
          viewBox="0 0 64 64"
          role="img"
          aria-label="志愿填报系统"
          className="shrink-0"
        >
          <rect x="8" y="6" width="40" height="52" rx="8" fill="#1677ff" />
          <rect x="14" y="14" width="28" height="4" rx="2" fill="#ffffff" opacity="0.9" />
          <rect x="14" y="24" width="22" height="4" rx="2" fill="#ffffff" opacity="0.9" />
          <rect x="14" y="34" width="26" height="4" rx="2" fill="#ffffff" opacity="0.9" />
          <path
            d="M44 14l12 12-18 18H26V32l18-18z"
            fill="#ff4d4f"
          />
          <path d="M41 17l6 6" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <div className="min-w-0">
          <div className="text-xl font-semibold text-slate-900">志愿填报系统</div>
          <div className="text-sm text-slate-600">宗老师 13779887445</div>
        </div>
      </div>
      <div>
        <div className="text-base font-semibold text-slate-900">用户登录</div>
        <div className="mt-1 text-sm text-slate-600">首次输入手机号和密码会自动注册并直接登录</div>
      </div>
    </div>
  );
}

function normalizePublicUrl(raw: string | undefined, fallbackOrigin: string): string {
  const candidate = raw && raw.trim() ? raw.trim() : "";
  if (!candidate) return `${fallbackOrigin}/#/login2`;
  try {
    const u = new URL(candidate);
    if (u.hash) return candidate;
    return `${u.origin}/#/login2`;
  } catch {
    const cleaned = candidate.replace(/\/+$/, "");
    return cleaned.includes("#") ? cleaned : `${cleaned}/#/login2`;
  }
}

function downloadBase64Png(base64: string, filename: string) {
  if (!base64) return;
  const a = document.createElement("a");
  a.href = `data:image/png;base64,${base64}`;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function generateQrPngBase64(value: string, targetSizePx: number): string {
  const qr = QrCode.encodeText(value, ERROR_LEVEL_MAP.M);
  const modules = qr.getModules();
  const margin = 4;
  const count = modules.length + margin * 2;
  const scale = Math.max(1, Math.floor(targetSizePx / count));
  const size = count * scale;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = "#000000";
  for (let y = 0; y < modules.length; y++) {
    const row = modules[y];
    for (let x = 0; x < row.length; x++) {
      if (!row[x]) continue;
      ctx.fillRect((x + margin) * scale, (y + margin) * scale, scale, scale);
    }
  }

  const dataUrl = canvas.toDataURL("image/png");
  const base64 = dataUrl.split(",")[1] ?? "";
  return base64;
}

export function LoginV2Page() {
  const navigate = useNavigate();
  const [api, contextHolder] = message.useMessage();
  const [form] = Form.useForm<Values>();

  const rawPublicUrl =
    (typeof window !== "undefined" ? window.__APP_CONFIG__?.publicSiteUrl : undefined) ??
    (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined);

  const publicUrl = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://volunteerformapp.z1.web.core.windows.net";
    return normalizePublicUrl(rawPublicUrl, origin);
  }, [rawPublicUrl]);

  useEffect(() => {
    const auth = getAuth();
    if (!auth) return;
    if (auth.role === "admin") navigate("/admin", { replace: true });
    else navigate("/profile", { replace: true });
  }, [navigate]);

  async function onFinish(values: Values) {
    const phone = values.phone.replace(/\s+/g, "").trim();
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
      setAuth({ token: data.token, role: data.role });
      navigate(data.role === "admin" ? "/admin" : "/profile", { replace: true });
    } catch (err: any) {
      api.error(err?.message || "登录失败");
    }
  }

  return (
    <AuthLayout header={<BrandHeader />} title="用户登录" subtitle="首次输入手机号和密码会自动注册并直接登录" maxWidthClassName="max-w-3xl">
      {contextHolder}
      <div className="grid gap-6 md:grid-cols-2 md:items-start">
        <div>
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
            <div className="mt-4 text-sm text-slate-600">
              管理员请前往 <Link to="/admin-login">管理员登录</Link>
            </div>
          </Form>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-medium text-slate-900">登录二维码</div>
          <div className="mt-3 flex justify-center">
            <QRCode value={publicUrl} size={168} />
          </div>
          <div className="mt-3 break-words text-center">
            <a className="text-xs text-slate-600 underline" href={publicUrl} target="_blank" rel="noreferrer">
              {publicUrl}
            </a>
          </div>
          <div className="mt-3 flex justify-center">
            <Button
              onClick={() => {
                const base64 = generateQrPngBase64(publicUrl, 720);
                downloadBase64Png(base64, "志愿填报系统-登录二维码.png");
              }}
            >
              下载二维码
            </Button>
          </div>
          <div className="mt-2 text-center text-xs text-slate-500">可下载后打印或线下使用</div>
        </div>
      </div>
    </AuthLayout>
  );
}
