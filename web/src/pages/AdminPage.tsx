import { Button, Input, Popconfirm, Select, Space, Spin, Table, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { QrCode } from "@rc-component/qrcode/es/libs/qrcodegen";
import { ERROR_LEVEL_MAP } from "@rc-component/qrcode/es/utils";

import { deleteAdminFormById, getAdminFormById, getAdminForms } from "../api/admin";
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

function toBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.slice(i, i + chunk));
  }
  return btoa(binary);
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

type QrAsset = { name: string; cid: string; base64: string };

function wrapBase64(b64: string): string {
  const s = String(b64 ?? "");
  if (!s) return "";
  const lines: string[] = [];
  for (let i = 0; i < s.length; i += 76) {
    lines.push(s.slice(i, i + 76));
  }
  return lines.join("\r\n");
}

function buildMhtmlDoc(html: string, assets: QrAsset[]): string {
  const boundary = `----=_NextPart_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  const startCid = "main@export";
  const header =
    `MIME-Version: 1.0\r\n` +
    `Content-Type: multipart/related; boundary="${boundary}"; type="text/html"; start="<${startCid}>"\r\n\r\n`;

  const htmlBase64 = wrapBase64(toBase64Utf8(html));
  const htmlPart =
    `--${boundary}\r\n` +
    `Content-Type: text/html; charset="utf-8"\r\n` +
    `Content-Transfer-Encoding: base64\r\n` +
    `Content-ID: <${startCid}>\r\n` +
    `Content-Location: file:///C:/export.html\r\n\r\n` +
    `${htmlBase64}\r\n\r\n`;

  const assetParts = assets
    .map((a) => {
      const base64 = wrapBase64(a.base64);
      const content =
        `--${boundary}\r\n` +
        `Content-Type: image/png\r\n` +
        `Content-Transfer-Encoding: base64\r\n` +
        `Content-ID: <${a.cid}>\r\n` +
        `Content-Location: ${a.name}\r\n\r\n` +
        `${base64}\r\n\r\n`;
      return content;
    })
    .join("");

  const footer = `--${boundary}--\r\n`;
  return header + htmlPart + assetParts + footer;
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
  opts?: { publicUrl?: string; qrSrcMap?: Record<string, string> }
) {
  const publicUrl = (opts?.publicUrl ?? "").replace(/\/+$/, "");
  const qrSrcMap = opts?.qrSrcMap ?? {};
  const brandLogoSvg = `
    <svg class="brand-logo" viewBox="0 0 64 64" aria-label="志愿填报系统" role="img">
      <rect x="8" y="6" width="40" height="52" rx="8" fill="#1677ff" />
      <rect x="14" y="14" width="28" height="4" rx="2" fill="#ffffff" opacity="0.9" />
      <rect x="14" y="24" width="22" height="4" rx="2" fill="#ffffff" opacity="0.9" />
      <rect x="14" y="34" width="26" height="4" rx="2" fill="#ffffff" opacity="0.9" />
      <path d="M44 14l12 12-18 18H26V32l18-18z" fill="#ff4d4f" />
      <path d="M41 17l6 6" stroke="#ffffff" stroke-width="3" stroke-linecap="round" />
    </svg>
  `.trim();
  const css = `
    @page { size: A4; margin: 10mm; }
    body { font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif; color: #111; }
    .page { page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    h1 { font-size: 18px; margin: 0; text-align: center; letter-spacing: 1px; line-height: 1.2; }
    .header { position: relative; margin: 0 0 6px; }
    .header-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
    .header-left { flex: 1; min-width: 0; }
    .brand { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin: 0 0 6px; }
    .brand-left { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .brand-logo { width: 34px; height: 34px; flex: 0 0 auto; }
    .brand-text { min-width: 0; }
    .brand-name { font-size: 12px; font-weight: 800; line-height: 1.2; color: #111; }
    .brand-contact { font-size: 10px; color: #111; line-height: 1.2; white-space: nowrap; padding-top: 1px; }
    .header-right { width: 88px; text-align: right; flex: 0 0 auto; }
    .qr-img { width: 72px; height: 72px; display: inline-block; }
    .qr-label { font-size: 10px; color: #333; margin: 0 0 4px; }
    .meta { display: flex; gap: 10px; flex-wrap: wrap; font-size: 10px; margin: 4px 0 0; }
    .meta .item { white-space: nowrap; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    td, th { border: 1px solid #333; padding: 3px 4px; font-size: 10.5px; vertical-align: top; line-height: 1.25; word-break: break-word; overflow-wrap: anywhere; }
    th { background: #f3f4f6; font-weight: 600; }
    table.kv col.k { width: 12%; }
    table.kv col.v { width: 21%; }
    .label { background: #fafafa; font-weight: 600; white-space: nowrap; }
    .section-title { font-size: 12px; font-weight: 700; margin: 8px 0 4px; }
    .muted { color: #666; }
    .line { border-bottom: 1px solid #999; min-height: 18px; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .major-table.fixed10 { height: 240mm; }
    .major-table.fixed10 thead tr { height: 10mm; }
    .major-table.fixed10 tbody tr { height: calc((240mm - 10mm) / 10); }
    .major-table.fixed10 td { vertical-align: middle; }
  `;

  function pageHtml(form: AdminFormRecord) {
    const content = form.content as FormContent;
    const name = formatTextValue("考生姓名", (content as any)?.name);
    const phone = form.userId?.phone ?? "-";
    const typeText = mapFormType(form.type);
    const statusText = form.status === "submitted" ? "已提交" : "草稿";
    const filledAtText = form.updatedAt ? formatTime(form.updatedAt) : "-";
    const qrUrl = publicUrl ? `${publicUrl}/#/form/${form.type}?id=${form._id}` : "";
    const qrSrc = qrUrl ? (qrSrcMap[form._id] ?? "") : "";

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

    const kvColgroup = `
          <colgroup>
            <col class="k" /><col class="v" />
            <col class="k" /><col class="v" />
            <col class="k" /><col class="v" />
          </colgroup>
    `;

    const majorList: any[] = Array.isArray(majors) ? majors : [];
    const paddedMajors =
      majorList.length <= 10
        ? [...majorList, ...Array.from({ length: Math.max(0, 10 - majorList.length) }, () => ({}))]
        : majorList;
    const majorTableClass = majorList.length <= 10 ? "major-table fixed10" : "major-table";
    const majorRows = paddedMajors
      .map((m, idx) => {
        const cat = escapeHtml(String(m?.majorCategory ?? ""));
        const mn = escapeHtml(String(m?.majorName ?? ""));
        const catText = cat || "";
        const mnText = mn || "";
        return `<tr><td style="width: 8%;">${idx + 1}</td><td style="width: 32%;">${catText}</td><td>${mnText}</td></tr>`;
      })
      .join("");

    return `
      <div class="page">
        <div class="header">
          <div class="header-top">
            <div class="header-left">
              <div class="brand">
                <div class="brand-left">
                  ${brandLogoSvg}
                  <div class="brand-text">
                    <div class="brand-name">志愿填报系统</div>
                  </div>
                </div>
                <div class="brand-contact">宗老师 13779887445</div>
              </div>
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
              ${qrSrc ? `<img class="qr-img" src="${qrSrc}" />` : ""}
            </div>
          </div>
        </div>

        <div class="section-title">基础信息</div>
        <table class="kv">
          ${kvColgroup}
          <tr>
            <td class="label">考生姓名</td><td class="value">${escapeHtml(name)}</td>
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
        <table class="kv">
          ${kvColgroup}
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
            <td class="label">体检结论</td><td class="value" colspan="3">${escapeHtml(formatTextValue("体检结论", (content as any)?.physicalExamConclusion))}</td>
          </tr>
          <tr>
            <td class="label">体检是否正常</td><td class="value" colspan="5">${escapeHtml(formatTextValue("体检是否正常", (content as any)?.physicalExamNormal))}</td>
          </tr>
        </table>

        <div class="section-title">高考成绩</div>
        <table class="kv">
          ${kvColgroup}
          <tr>
            <td class="label">总分</td><td class="value">${escapeHtml(formatTextValue("总分", (content as any)?.scores?.totalScore))}</td>
            <td class="label">位次</td><td class="value">${escapeHtml(formatTextValue("位次", (content as any)?.scores?.rank))}</td>
            <td class="label">选科</td><td class="value">${escapeHtml(formatTextValue("选科", selectedSubjects))}</td>
          </tr>
          ${scoreRows}
        </table>

        <div class="section-title">家庭情况</div>
        <table class="kv">
          ${kvColgroup}
          <tr>
            <td class="label">父亲姓名</td><td class="value">${escapeHtml(formatTextValue("父亲姓名", (content as any)?.fatherName))}</td>
            <td class="label">母亲姓名</td><td class="value">${escapeHtml(formatTextValue("母亲姓名", (content as any)?.motherName))}</td>
            <td class="label">父亲职业</td><td class="value">${escapeHtml(formatTextValue("父亲职业", (content as any)?.fatherOccupation))}</td>
          </tr>
          <tr>
            <td class="label">母亲职业</td><td class="value">${escapeHtml(formatTextValue("母亲职业", (content as any)?.motherOccupation))}</td>
            <td class="label">社会资源</td><td class="value" colspan="3">${escapeHtml(formatTextValue("社会资源", (content as any)?.socialResources))}</td>
          </tr>
        </table>

        <div class="section-title">志愿条件</div>
        <table class="kv">
          ${kvColgroup}
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

      </div>
      <div class="page major-page">
        <div class="header">
          <h1>专业意向表格</h1>
          <div class="meta">
            <div class="item">姓名：${escapeHtml(name)}</div>
            <div class="item">手机号：${escapeHtml(String(phone))}</div>
            <div class="item">类型：${escapeHtml(typeText)}</div>
            <div class="item">状态：${escapeHtml(statusText)}</div>
            <div class="item">填写时间：${escapeHtml(filledAtText)}</div>
          </div>
        </div>
        <table class="${majorTableClass}">
          <thead>
            <tr>
              <th style="width: 8%;">序</th>
              <th style="width: 32%;">专业大类</th>
              <th>具体专业</th>
            </tr>
          </thead>
          <tbody>
            ${majorRows}
          </tbody>
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

function downloadWordMhtml(html: string, assets: QrAsset[], filename: string) {
  const mhtml = buildMhtmlDoc(html, assets);
  const blob = new Blob([mhtml], { type: "message/rfc822" });
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
  const startedAt = Date.now();
  const check = () => {
    const imgs = Array.from(w.document.images ?? []);
    const allLoaded = imgs.every((img) => img.complete);
    if (allLoaded || Date.now() - startedAt > 4000) {
      w.print();
      return;
    }
    setTimeout(check, 80);
  };
  setTimeout(check, 60);
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
    for (const f of list) {
      const qrSrcMap: Record<string, string> = {};
      const assets: QrAsset[] = [];
      const url = `${publicUrl}/#/form/${f.type}?id=${f._id}`;
      const name = `qr_${f._id}.png`;
      const cid = `qr_${f._id}@export`;
      const base64 = generateQrPngBase64(url, 96);
      if (base64) {
        qrSrcMap[f._id] = `cid:${cid}`;
        assets.push({ name, cid, base64 });
      }
      const typeText = mapFormType(f.type);
      const nameText = String(((f.content as any)?.name ?? "") || "未命名");
      const date = f.updatedAt
        ? new Date(f.updatedAt).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      const filename = `${typeText}-${nameText}-导出-${date}.mht`;
      const html = buildExportHtml([f], filename.replace(/\.mht$/, ""), { publicUrl, qrSrcMap });
      downloadWordMhtml(html, assets, filename);
    }
  }

  async function exportPdf() {
    const list = await getSelectedFormsForExport();
    if (!list.length) return;
    const publicUrl = getPublicSiteUrl();
    list.forEach((f, idx) => {
      const qrSrcMap: Record<string, string> = {};
      const url = `${publicUrl}/#/form/${f.type}?id=${f._id}`;
      const base64 = generateQrPngBase64(url, 96);
      if (base64) {
        qrSrcMap[f._id] = `data:image/png;base64,${base64}`;
      }
      const typeText = mapFormType(f.type);
      const nameText = String(((f.content as any)?.name ?? "") || "未命名");
      const date = f.updatedAt
        ? new Date(f.updatedAt).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      const title = `${typeText}-${nameText}-导出-${date}`;
      const html = buildExportHtml([f], title, { publicUrl, qrSrcMap });
      window.setTimeout(() => printToPdf(html), idx * 800);
    });
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
