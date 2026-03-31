import { Button } from "antd";
import { useNavigate } from "react-router-dom";

import { AppCard } from "../components/AppCard";
import { MainLayout } from "../layouts/MainLayout";
import { isLoggedIn, isAdmin } from "../store/auth";

export function NotFoundPage() {
  const navigate = useNavigate();
  const homePath = !isLoggedIn() ? "/login" : isAdmin() ? "/admin" : "/profile";

  return (
    <MainLayout title="页面不存在">
      <div className="mx-auto max-w-xl">
        <AppCard className="space-y-3">
          <div className="text-lg font-semibold text-slate-900">404</div>
          <div className="text-sm text-slate-600">你访问的页面不存在。</div>
          <Button type="primary" onClick={() => navigate(homePath, { replace: true })}>
            返回
          </Button>
        </AppCard>
      </div>
    </MainLayout>
  );
}

