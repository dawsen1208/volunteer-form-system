import { Button } from "antd";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { StatusTag } from "../components/StatusTag";
import { clearAuth, getAuth } from "../store/auth";

type Props = {
  children: ReactNode;
  title?: string;
};

export function MainLayout(props: Props) {
  const navigate = useNavigate();
  const auth = getAuth();

  return (
    <div className="min-h-full">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="text-sm font-semibold text-slate-900">
              {props.title ?? "志愿表单系统"}
            </div>
            {auth?.role ? <StatusTag kind="role" value={auth.role} /> : null}
          </div>
          {auth ? (
            <Button
              onClick={() => {
                clearAuth();
                navigate("/login", { replace: true });
              }}
            >
              退出登录
            </Button>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{props.children}</main>
    </div>
  );
}
