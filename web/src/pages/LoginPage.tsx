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

function BrandHeaderLegacy(props: { size?: number }) {
  const size = props.size ?? 44;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <svg
          width={size}
          height={size}
          viewBox="0 0 64 64"
          role="img"
          aria-label="北京格学教育"
          className="shrink-0"
        >
          <circle cx="32" cy="32" r="30" fill="#7A0C0C" />
          <circle cx="32" cy="32" r="26" fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.9" />
          <text
            x="32"
            y="38"
            textAnchor="middle"
            fontSize="18"
            fontFamily="STKaiti, KaiTi, SimSun, Microsoft YaHei, PingFang SC, Arial"
            fill="#ffffff"
            fontWeight="700"
          >
            格学
          </text>
        </svg>
        <div className="min-w-0">
          <div className="text-xl font-semibold text-red-700">北京格学教育</div>
          <div className="text-sm font-semibold uppercase tracking-widest text-red-700">
            BEIJING GEXUE EDUCATION
          </div>
          <div className="text-sm text-slate-700">丁老师 13396216040 · 李老师 15163091937</div>
        </div>
      </div>
      <div>
        <div className="text-base font-semibold text-slate-900">用户登录</div>
        <div className="mt-1 text-sm text-slate-600">首次输入手机号和密码会自动注册并直接登录</div>
      </div>
    </div>
  );
}

function normalizePublicUrl(raw: string | undefined, fallbackOrigin: string, hashPath: string): string {
  const candidate = raw && raw.trim() ? raw.trim() : "";
  const normalizedHash = hashPath.startsWith("/") ? hashPath : `/${hashPath}`;
  if (!candidate) return `${fallbackOrigin}/#${normalizedHash}`;
  try {
    const u = new URL(candidate);
    return `${u.origin}/#${normalizedHash}`;
  } catch {
    const cleaned = candidate.split("#")[0].replace(/\/+$/, "");
    return `${cleaned}/#${normalizedHash}`;
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

export function LoginPage() {
  const navigate = useNavigate();
  const [api, contextHolder] = message.useMessage();
  const [form] = Form.useForm<Values>();
  const rawPublicUrl =
    (typeof window !== "undefined" ? window.__APP_CONFIG__?.publicSiteUrl : undefined) ??
    (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined);
  const publicUrl = useMemo(() => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://volunteerformapp.z1.web.core.windows.net";
    return normalizePublicUrl(rawPublicUrl, origin, "/login");
  }, [rawPublicUrl]);

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
      setAuth({ token: data.token, role: data.role });
      navigate(data.role === "admin" ? "/admin" : "/profile", { replace: true });
    } catch (err: any) {
      api.error(err?.message || "登录失败");
    }
  }

  return (
    <AuthLayout
      title="用户登录"
      subtitle="首次输入手机号和密码会自动注册并直接登录"
      header={<BrandHeaderLegacy />}
      maxWidthClassName="max-w-3xl"
    >
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
            <div className="mt-2 text-center text-xs text-slate-500">首次进入系统加载时间较长，请耐心等待</div>
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
                downloadBase64Png(base64, "北京格学教育-登录二维码.png");
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
