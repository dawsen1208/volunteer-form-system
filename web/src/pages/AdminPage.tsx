import { Alert, Button, Input, Popconfirm, QRCode, Select, Space, Spin, Table, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { useNavigate } from "react-router-dom";

import { deleteAdminFormById, getAdminFormById, getAdminForms } from "../api/admin";
import { apiClient } from "../api/client";
import { AppCard } from "../components/AppCard";
import { PageHeader } from "../components/PageHeader";
import { StatusTag } from "../components/StatusTag";
import { MainLayout } from "../layouts/MainLayout";
import type { AdminFormRecord, FormContent, FormStatus, FormType } from "../types";
import { getValueAtPath } from "../utils/formSchema";
import { mapFormType } from "../utils/mapping";

function formatTime(value: string) {
  const t = new Date(value);
  if (Number.isNaN(t.getTime())) return value;
  return t.toLocaleString();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getPublicSiteUrl(): string {
  const rawPublicUrl =
    (typeof window !== "undefined" ? window.__APP_CONFIG__?.publicSiteUrl : undefined) ??
    (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined);
  const candidate = rawPublicUrl && rawPublicUrl.trim() ? rawPublicUrl.trim() : window.location.origin;
  try {
    const u = new URL(candidate);
    return u.origin;
  } catch {
    return candidate.split("#")[0].replace(/\/+$/, "");
  }
}

async function generateQrPngDataUrl(value: string, size: number): Promise<string> {
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = `${size}px`;
  host.style.height = `${size}px`;
  document.body.appendChild(host);

  const root = createRoot(host);
  root.render(<QRCode value={value} size={size} type="canvas" />);

  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  const canvas = host.querySelector("canvas") as HTMLCanvasElement | null;
  const dataUrl = canvas ? canvas.toDataURL("image/png") : "";

  root.unmount();
  host.remove();
  return dataUrl;
}

async function generateQrImagesForExport(
  forms: AdminFormRecord[],
  publicUrl: string
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  for (const f of forms) {
    const url = `${publicUrl}/#/form/${f.type}?id=${f._id}`;
    map[f._id] = await generateQrPngDataUrl(url, 120);
  }
  return map;
}

function formatTextValue(label: string, value: any) {
  if (value === undefined || value === null || value === "") return "-";
  if (label === "体检是否正常") return value === true ? "正常" : "不正常";
  if (label === "家庭地址") {
    if (typeof value === "string") return value || "-";
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const v = value as any;
      const parts = [v.province, v.city, v.county, v.detail].map((x) => String(x ?? "").trim()).filter(Boolean);
      return parts.length ? parts.join("") : "-";
    }
  }
  if (label === "身高") {
    const raw = String(value ?? "").trim();
    if (!raw) return "-";
    return /[a-zA-Z\u4e00-\u9fa5]/.test(raw) ? raw : `${raw}cm`;
  }
  if (label === "体重") {
    const raw = String(value ?? "").trim();
    if (!raw) return "-";
    return /[a-zA-Z\u4e00-\u9fa5]/.test(raw) ? raw : `${raw}kg`;
  }
  if (typeof value === "boolean") return value ? "是" : "否";
  if (Array.isArray(value)) return value.length ? value.join("、") : "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function getScoreFieldName(subject: string) {
  if (subject === "语文") return ["scores", "chineseScore"];
  if (subject === "数学") return ["scores", "mathScore"];
  if (subject === "英语") return ["scores", "englishScore"];
  if (subject === "物理") return ["scores", "physicsScore"];
  if (subject === "化学") return ["scores", "chemistryScore"];
  if (subject === "生物") return ["scores", "biologyScore"];
  if (subject === "政治") return ["scores", "politicsScore"];
  if (subject === "历史") return ["scores", "historyScore"];
  if (subject === "地理") return ["scores", "geographyScore"];
  return null;
}

function buildExportHtml(
  forms: AdminFormRecord[],
  docTitle?: string,
  opts?: { publicUrl?: string; qrImages?: Record<string, string> }
) {
  const publicUrl = (opts?.publicUrl ?? "").replace(/\/+$/, "");
  const qrImages = opts?.qrImages ?? {};
  const css = `
    @page { size: A4; margin: 10mm; }
    body { font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif; color: #111; }
    .page { page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    h1 { font-size: 18px; margin: 0; text-align: center; letter-spacing: 1px; line-height: 1.2; }
    .header { display: flex; gap: 10px; align-items: flex-start; justify-content: space-between; margin: 0 0 6px; }
    .header-left { flex: 1; min-width: 0; }
    .header-right { width: 130px; text-align: right; }
    .qr { width: 120px; height: 120px; display: inline-block; }
    .qr-label { font-size: 10px; color: #333; margin: 0 0 4px; }
    .qr-url { font-size: 9px; color: #666; word-break: break-all; line-height: 1.2; }
    .meta { display: flex; gap: 10px; flex-wrap: wrap; font-size: 10px; margin: 4px 0 0; }
    .meta .item { white-space: nowrap; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    td, th { border: 1px solid #333; padding: 3px 4px; font-size: 10.5px; vertical-align: top; line-height: 1.25; }
    th { background: #f3f4f6; font-weight: 600; }
    .label { width: 12%; background: #fafafa; font-weight: 600; }
    .value { width: 21%; }
    .section-title { font-size: 12px; font-weight: 700; margin: 8px 0 4px; }
    .muted { color: #666; }
    .line { border-bottom: 1px solid #999; min-height: 18px; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  `;

  function pageHtml(form: AdminFormRecord) {
    const content = form.content as FormContent;
    const name = formatTextValue("姓名", (content as any)?.name);
    const phone = form.userId?.phone ?? "-";
    const typeText = mapFormType(form.type);
    const statusText = form.status === "submitted" ? "已提交" : "草稿";
    const filledAtText = form.updatedAt ? formatTime(form.updatedAt) : "-";
    const qrUrl = publicUrl ? `${publicUrl}/#/form/${form.type}?id=${form._id}` : "";
    const qrImg = qrImages[form._id] ?? "";

    const selectedSubjects: string[] = Array.isArray((content as any)?.scores?.subjectsSelected)
      ? ((content as any).scores.subjectsSelected as string[])
      : [];

    const subjectScoreItems = selectedSubjects
      .map((s) => {
        const path = getScoreFieldName(s);
        const v = path ? getValueAtPath(content as any, path) : "";
        return { subject: s, scoreText: formatTextValue(s, v) };
      })
      .filter((x) => x.subject);

    const scoreRows = (() => {
      if (!subjectScoreItems.length) return "";
      const chunks: Array<Array<{ subject: string; scoreText: string }>> = [];
      for (let i = 0; i < subjectScoreItems.length; i += 3) {
        chunks.push(subjectScoreItems.slice(i, i + 3));
      }
      return chunks
        .map((chunk) => {
          const cells = Array.from({ length: 3 }).map((_, idx) => chunk[idx] ?? null);
          const tds = cells
            .map((c) => {
              if (!c) return `<td class="label"></td><td class="value"></td>`;
              return `<td class="label">${escapeHtml(c.subject)}</td><td class="value">${escapeHtml(c.scoreText)}</td>`;
            })
            .join("");
          return `<tr>${tds}</tr>`;
        })
        .join("");
    })();

    const provinces: string[] = Array.isArray((content as any)?.intendedProvinces) ? (content as any).intendedProvinces : [];
    const majors: any[] = Array.isArray((content as any)?.majorPreferences) ? (content as any).majorPreferences : [];

    const majorRows = majors.length
      ? majors
          .map((m, idx) => {
            const cat = escapeHtml(String(m?.majorCategory ?? ""));
            const mn = escapeHtml(String(m?.majorName ?? ""));
            return `<tr><td style="width: 8%;">${idx + 1}</td><td style="width: 32%;">${cat || "-"}</td><td>${mn || "-"}</td></tr>`;
          })
          .join("")
      : `<tr><td style="width: 8%;">1</td><td style="width: 32%;">-</td><td>-</td></tr>`;

    return `
      <div class="page">
        <div class="header">
          <div class="header-left">
            <h1>高考志愿填报约谈表</h1>
            <div class="meta">
              <div class="item">姓名：${escapeHtml(name)}</div>
              <div class="item">手机号：${escapeHtml(String(phone))}</div>
              <div class="item">类型：${escapeHtml(typeText)}</div>
              <div class="item">状态：${escapeHtml(statusText)}</div>
              <div class="item">填写时间：${escapeHtml(filledAtText)}</div>
            </div>
          </div>
          <div class="header-right">
            <div class="qr-label">扫码打开线上表单</div>
            ${qrImg ? `<img class="qr" src="${qrImg}" />` : ""}
            ${qrUrl ? `<div class="qr-url">${escapeHtml(qrUrl)}</div>` : ""}
          </div>
        </div>

        <div class="section-title">基础信息</div>
        <table>
          <tr>
            <td class="label">姓名</td><td class="value">${escapeHtml(name)}</td>
            <td class="label">性别</td><td class="value">${escapeHtml(formatTextValue("性别", (content as any)?.gender))}</td>
            <td class="label">民族</td><td class="value">${escapeHtml(formatTextValue("民族", (content as any)?.ethnicity))}</td>
          </tr>
          <tr>
            <td class="label">出生日期</td><td class="value">${escapeHtml(formatTextValue("出生日期", (content as any)?.birthDate))}</td>
            <td class="label">身高</td><td class="value">${escapeHtml(formatTextValue("身高", (content as any)?.height))}</td>
            <td class="label">体重</td><td class="value">${escapeHtml(formatTextValue("体重", (content as any)?.weight))}</td>
          </tr>
          <tr>
            <td class="label">届别</td><td class="value">${escapeHtml(formatTextValue("届别", (content as any)?.graduateStatus))}</td>
            <td class="label">考生电话</td><td class="value">${escapeHtml(formatTextValue("考生电话", (content as any)?.candidatePhone))}</td>
            <td class="label">家长电话</td><td class="value">${escapeHtml(formatTextValue("家长电话", (content as any)?.parentPhone))}</td>
          </tr>
          <tr>
            <td class="label">家庭地址</td><td class="value" colspan="5">${escapeHtml(formatTextValue("家庭地址", (content as any)?.homeAddress))}</td>
          </tr>
          <tr>
            <td class="label">身份证号</td><td class="value" colspan="3">${escapeHtml(formatTextValue("身份证号", (content as any)?.idNumber))}</td>
            <td class="label">考生号</td><td class="value">${escapeHtml(formatTextValue("考生号", (content as any)?.examNumber))}</td>
          </tr>
          <tr>
            <td class="label">推荐人</td><td class="value" colspan="5">${escapeHtml(formatTextValue("推荐人", (content as any)?.referrer))}</td>
          </tr>
        </table>

        <div class="section-title">学业与学校信息</div>
        <table>
          <tr>
            <td class="label">考试类别</td><td class="value">${escapeHtml(formatTextValue("考试类别", (content as any)?.candidateCategory))}</td>
            <td class="label">专业成绩</td><td class="value">${escapeHtml(formatTextValue("专业成绩", (content as any)?.professionalScore))}</td>
            <td class="label">优势学科</td><td class="value">${escapeHtml(formatTextValue("优势学科", (content as any)?.advantageSubjects))}</td>
          </tr>
          <tr>
            <td class="label">毕业学校</td><td class="value" colspan="3">${escapeHtml(formatTextValue("毕业学校", (content as any)?.graduateSchool))}</td>
            <td class="label">班级</td><td class="value">${escapeHtml(formatTextValue("班级", (content as any)?.className))}</td>
          </tr>
          <tr>
            <td class="label">班主任</td><td class="value">${escapeHtml(formatTextValue("班主任", (content as any)?.classTeacher))}</td>
            <td class="label">体检结论</td><td class="value" colspan="2">${escapeHtml(formatTextValue("体检结论", (content as any)?.physicalExamConclusion))}</td>
            <td class="label">体检是否正常</td><td class="value">${escapeHtml(formatTextValue("体检是否正常", (content as any)?.physicalExamNormal))}</td>
          </tr>
        </table>

        <div class="section-title">高考成绩</div>
        <table>
          <tr>
            <td class="label">总分</td><td class="value">${escapeHtml(formatTextValue("总分", (content as any)?.scores?.totalScore))}</td>
            <td class="label">位次</td><td class="value">${escapeHtml(formatTextValue("位次", (content as any)?.scores?.rank))}</td>
            <td class="label">选科</td><td class="value">${escapeHtml(formatTextValue("选科", selectedSubjects))}</td>
          </tr>
          ${scoreRows}
        </table>

        <div class="section-title">家庭情况</div>
        <table>
          <tr>
            <td class="label">父亲职业</td><td class="value">${escapeHtml(formatTextValue("父亲职业", (content as any)?.fatherOccupation))}</td>
            <td class="label">母亲职业</td><td class="value">${escapeHtml(formatTextValue("母亲职业", (content as any)?.motherOccupation))}</td>
            <td class="label">社会资源</td><td class="value" colspan="1">${escapeHtml(formatTextValue("社会资源", (content as any)?.socialResources))}</td>
          </tr>
        </table>

        <div class="section-title">志愿条件</div>
        <table>
          <tr>
            <td class="label">意向省份</td><td class="value" colspan="5">${escapeHtml(formatTextValue("意向省份", provinces.map((p, idx) => `${idx + 1}.${p}`)))}</td>
          </tr>
          <tr>
            <td class="label">梦中大学或城市</td><td class="value" colspan="5">${escapeHtml(formatTextValue("梦中大学或城市", (content as any)?.dreamUniversityOrCity))}</td>
          </tr>
          <tr>
            <td class="label">备注</td><td class="value" colspan="5">${escapeHtml(formatTextValue("备注", (content as any)?.finalRemarks))}</td>
          </tr>
        </table>

        <div class="section-title">专业意向表格</div>
        <table>
          <tr>
            <th style="width: 8%;">序</th>
            <th style="width: 32%;">专业大类</th>
            <th>具体专业</th>
          </tr>
          ${majorRows}
        </table>
      </div>
    `;
  }

  const body = forms.map(pageHtml).join("");
  const title = docTitle ?? "表单导出";
  return `<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title><style>${css}</style></head><body>${body}</body></html>`;
}

function downloadWord(html: string, filename: string) {
  const blob = new Blob([html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function printToPdf(html: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
  }, 300);
}

export function AdminPage() {
  const navigate = useNavigate();
  const [api, contextHolder] = message.useMessage();
  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState<AdminFormRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<FormStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<FormType | "all">("all");
  const [phoneFilter, setPhoneFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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

  const filteredForms = useMemo(() => {
    const phone = phoneFilter.trim();
    return forms.filter((f) => {
      if (statusFilter !== "all" && f.status !== statusFilter) return false;
      if (typeFilter !== "all" && f.type !== typeFilter) return false;
      if (phone) {
        const p = f.userId?.phone ?? "";
        if (!p.includes(phone)) return false;
      }
      return true;
    });
  }, [forms, phoneFilter, statusFilter, typeFilter]);

  async function getSelectedFormsForExport() {
    const ids = selectedIds;
    if (!ids.length) {
      api.error("请先勾选要导出的表单");
      return [];
    }
    const list = await Promise.all(
      ids.map(async (id) => {
        try {
          return await getAdminFormById(id);
        } catch {
          return null;
        }
      })
    );
    const ok = list.filter(Boolean) as AdminFormRecord[];
    if (!ok.length) {
      api.error("导出失败：未能获取表单详情");
      return [];
    }
    return ok;
  }

  async function generateRecommendations() {
    const ids = selectedIds;
    if (!ids.length) {
      api.error("请先勾选要生成推荐的表单");
      return;
    }
    try {
      setLoading(true);
      const details = await Promise.all(ids.map(getAdminFormById));
      await Promise.all(
        details.map(async (d) => {
          await apiClient.post("/recommendations", { formId: d._id, content: d.content });
        })
      );
      api.success(`已开始生成 ${details.length} 条推荐结果（生成完成后可在用户端“查看推荐”查看）`);
    } catch (err: any) {
      api.error(err?.message || "生成推荐失败");
    } finally {
      setLoading(false);
    }
  }

  async function deleteSelectedForms() {
    const ids = selectedIds;
    if (!ids.length) {
      api.error("请先勾选要删除的表单");
      return;
    }
    try {
      setLoading(true);
      await Promise.all(ids.map((id) => deleteAdminFormById(id)));
      api.success(`已删除 ${ids.length} 条表单`);
      setSelectedIds([]);
      await load();
    } catch (err: any) {
      api.error(err?.message || "删除失败");
    } finally {
      setLoading(false);
    }
  }

  async function exportWord() {
    const list = await getSelectedFormsForExport();
    if (!list.length) return;
    const publicUrl = getPublicSiteUrl();
    const qrImages = await generateQrImagesForExport(list, publicUrl);
    const one = list.length === 1 ? list[0] : null;
    const typeText = one ? mapFormType(one.type) : "志愿表单";
    const nameText = one ? String(((one.content as any)?.name ?? "") || "未命名") : "批量";
    const date = one?.updatedAt
      ? new Date(one.updatedAt).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const filename = `${typeText}-${nameText}-导出-${date}.doc`;
    const html = buildExportHtml(list, filename.replace(/\.doc$/, ""), { publicUrl, qrImages });
    downloadWord(html, filename);
  }

  async function exportPdf() {
    const list = await getSelectedFormsForExport();
    if (!list.length) return;
    const publicUrl = getPublicSiteUrl();
    const qrImages = await generateQrImagesForExport(list, publicUrl);
    const one = list.length === 1 ? list[0] : null;
    const typeText = one ? mapFormType(one.type) : "志愿表单";
    const nameText = one ? String(((one.content as any)?.name ?? "") || "未命名") : "批量";
    const date = one?.updatedAt
      ? new Date(one.updatedAt).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const title = `${typeText}-${nameText}-导出-${date}`;
    const html = buildExportHtml(list, title, { publicUrl, qrImages });
    printToPdf(html);
  }

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
          <Space>
            <Button type="link" onClick={() => navigate(`/admin/forms/${record._id}`)}>
              查看详情
            </Button>
            <Popconfirm
              title="确认删除该表单？"
              description="删除后不可恢复。"
              okText="删除"
              okButtonProps={{ danger: true }}
              cancelText="取消"
              onConfirm={async () => {
                try {
                  setLoading(true);
                  await deleteAdminFormById(record._id);
                  api.success("已删除");
                  setSelectedIds((prev) => prev.filter((id) => id !== record._id));
                  await load();
                } catch (err: any) {
                  api.error(err?.message || "删除失败");
                } finally {
                  setLoading(false);
                }
              }}
            >
              <Button danger type="link">
                删除
              </Button>
            </Popconfirm>
          </Space>
        )
      }
    ],
    [api, navigate, selectedIds]
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
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Space wrap>
              <Select
                value={statusFilter}
                onChange={(v) => setStatusFilter(v)}
                style={{ width: 160 }}
                options={[
                  { label: "全部状态", value: "all" },
                  { label: "草稿", value: "draft" },
                  { label: "已提交", value: "submitted" }
                ]}
              />
              <Select
                value={typeFilter}
                onChange={(v) => setTypeFilter(v)}
                style={{ width: 180 }}
                options={[
                  { label: "全部表单类型", value: "all" },
                  { label: "本科志愿单", value: "undergrad" },
                  { label: "专科志愿单", value: "junior" }
                ]}
              />
              <Input
                value={phoneFilter}
                onChange={(e) => setPhoneFilter(e.target.value)}
                placeholder="按手机号筛选（包含）"
                style={{ width: 220 }}
                allowClear
              />
              <div className="text-sm text-slate-600">
                共 {filteredForms.length} 条
              </div>
            </Space>
            <Space wrap>
              <Button disabled={!selectedIds.length} onClick={exportPdf}>
                导出 PDF
              </Button>
              <Button disabled={!selectedIds.length} onClick={exportWord}>
                导出 Word
              </Button>
              <Button type="primary" disabled={!selectedIds.length} onClick={generateRecommendations}>
                生成推荐
              </Button>
              <Popconfirm
                title={`确认删除已勾选的 ${selectedIds.length} 条表单？`}
                description="删除后不可恢复。"
                okText="删除"
                okButtonProps={{ danger: true }}
                cancelText="取消"
                onConfirm={deleteSelectedForms}
                disabled={!selectedIds.length}
              >
                <Button danger disabled={!selectedIds.length}>
                  删除表单
                </Button>
              </Popconfirm>
            </Space>
          </div>
          <Alert
            type="warning"
            showIcon
            message="推荐功能声明"
            description="本推荐功能仅用于提供志愿填报建议，不包含录取预测功能；参与分析的所有数据均为往年数据，不保证推荐学校在当年一定能录取。"
            className="mb-4"
          />
          {loading ? (
            <div className="flex justify-center py-10">
              <Spin />
            </div>
          ) : (
            <Table
              rowKey="_id"
              rowSelection={{
                selectedRowKeys: selectedIds,
                onChange: (keys) => setSelectedIds(keys as string[])
              }}
              dataSource={filteredForms}
              columns={columns}
              pagination={{ pageSize: 10 }}
            />
          )}
        </AppCard>
      </div>
    </MainLayout>
  );
}
