import { Button, message } from "antd";
import { FileTextOutlined, UnorderedListOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

import { AppCard } from "../components/AppCard";
import { PageHeader } from "../components/PageHeader";
import { StatusTag } from "../components/StatusTag";
import { MainLayout } from "../layouts/MainLayout";
import { getAuth } from "../store/auth";

export function ProfilePage() {
  const navigate = useNavigate();
  const auth = getAuth();
  const [api, contextHolder] = message.useMessage();

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

    </MainLayout>
  );
}
