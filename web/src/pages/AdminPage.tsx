import { Button, Input, Select, Space, Spin, Table, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getAdminFormById, getAdminForms } from "../api/admin";
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

function formatTextValue(label: string, value: any) {
  if (value === undefined || value === null || value === "") return "-";
  if (label === "体检是否正常") return value === true ? "正常" : "不正常";
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

function buildExportHtml(forms: AdminFormRecord[]) {
  const css = `
    @page { size: A4; margin: 16mm; }
    body { font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif; color: #111; }
    .page { page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    h1 { font-size: 22px; margin: 0 0 10px; text-align: center; letter-spacing: 2px; }
    .meta { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; margin: 0 0 10px; }
    .meta .item { white-space: nowrap; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    td, th { border: 1px solid #333; padding: 6px 6px; font-size: 12px; vertical-align: top; }
    th { background: #f3f4f6; font-weight: 600; }
    .label { width: 14%; background: #fafafa; font-weight: 600; }
    .value { width: 19%; }
    .section-title { font-size: 14px; font-weight: 700; margin: 14px 0 6px; }
    .muted { color: #666; }
    .line { border-bottom: 1px solid #999; min-height: 18px; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  `;

  function pageHtml(form: AdminFormRecord) {
    const content = form.content as FormContent;
    const name = formatTextValue("姓名", (content as any)?.name);
    const phone = form.userId?.phone ?? "-";
    const fillTime = (content as any)?.fillTime ? formatTime(String((content as any).fillTime)) : "-";

    const selectedSubjects: string[] = Array.isArray((content as any)?.scores?.subjectsSelected)
      ? ((content as any).scores.subjectsSelected as string[])
      : [];

    const scoreRows = selectedSubjects.length
      ? selectedSubjects
          .map((s) => {
            const path = getScoreFieldName(s);
            const v = path ? getValueAtPath(content as any, path) : "";
            return `<tr><td class="label">${escapeHtml(s)}</td><td class="value" colspan="5">${escapeHtml(formatTextValue(s, v))}</td></tr>`;
          })
          .join("")
      : `<tr><td class="label">选科</td><td class="value" colspan="5">-</td></tr>`;

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
        <h1>高考志愿填报约谈表</h1>
        <div class="meta">
          <div class="item">用户手机号：${escapeHtml(phone)}</div>
          <div class="item">表单类型：${escapeHtml(mapFormType(form.type))}</div>
          <div class="item">状态：${escapeHtml(form.status)}</div>
          <div class="item">填表时间：${escapeHtml(fillTime)}</div>
          <div class="item">提交时间：${escapeHtml(form.submittedAt ? formatTime(form.submittedAt) : "-")}</div>
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
  return `<!doctype html><html><head><meta charset="utf-8" /><title>表单导出</title><style>${css}</style></head><body>${body}</body></html>`;
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

  async function exportWord() {
    const list = await getSelectedFormsForExport();
    if (!list.length) return;
    const html = buildExportHtml(list);
    downloadWord(html, `志愿表单导出-${new Date().toISOString().slice(0, 10)}.doc`);
  }

  async function exportPdf() {
    const list = await getSelectedFormsForExport();
    if (!list.length) return;
    const html = buildExportHtml(list);
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
          <Button type="link" onClick={() => navigate(`/admin/forms/${record._id}`)}>
            查看详情
          </Button>
        )
      }
    ],
    [navigate]
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
            </Space>
          </div>
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
