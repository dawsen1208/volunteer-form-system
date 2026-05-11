import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { spawn } from "child_process";
import crypto from "crypto";

import mongoose from "mongoose";

import { AppError } from "../utils/errors";
import { FormModel } from "../models/Form";

type RecommendInput = Record<string, any>;

export type RecommendationEngineResponse = {
  ok: boolean;
  mode?: string;
  formType?: string;
  items: Array<Record<string, any>>;
  [key: string]: any;
};

export type RecommendationStatusResponse =
  | { ok: true; status: "done"; result: RecommendationEngineResponse }
  | { ok: true; status: "failed"; message: string }
  | { ok: true; status: "pending"; progress?: { percent: number; step?: string } }
  | { ok: true; status: "none" };

type RecommendationCacheEntry = {
  forUpdatedAt: string;
  forKey?: string;
  result: RecommendationEngineResponse;
  generatedAt: string;
};

type RecommendationErrorEntry = {
  forUpdatedAt: string;
  forKey?: string;
  message: string;
  failedAt: string;
};

type RecommendationJobEntry = {
  forUpdatedAt: string;
  forKey: string;
  startedAt: string;
  progress: { percent: number; step?: string; updatedAt: string };
};

type RunningJob = {
  startedAt: number;
  proc: import("child_process").ChildProcess;
  canceled: boolean;
  progress?: { percent: number; step?: string; updatedAt: number };
  lastPersistAt?: number;
};

const runningJobs = new Map<string, RunningJob>();
const RECOMMEND_TIMEOUT_MS = Number(process.env.RECOMMEND_TIMEOUT_MS ?? 6 * 60 * 1000);

function normalizeId(value: unknown) {
  const v = typeof value === "string" ? value.trim() : "";
  return v || null;
}

function getUpdatedAtIso(doc: any): string {
  const v = doc?.updatedAt;
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(v);
  const t = d.getTime();
  if (Number.isNaN(t)) return "";
  return d.toISOString();
}

function readRecommendationCache(formDoc: any): RecommendationCacheEntry | null {
  const c = formDoc?.content;
  if (!c || typeof c !== "object") return null;
  const entry = (c as any).__recommendation;
  if (!entry || typeof entry !== "object") return null;
  if (typeof entry.forUpdatedAt !== "string") return null;
  if (!entry.result || typeof entry.result !== "object") return null;
  return entry as RecommendationCacheEntry;
}

function readRecommendationError(formDoc: any): RecommendationErrorEntry | null {
  const c = formDoc?.content;
  if (!c || typeof c !== "object") return null;
  const entry = (c as any).__recommendationError;
  if (!entry || typeof entry !== "object") return null;
  if (typeof entry.forUpdatedAt !== "string") return null;
  if (typeof entry.message !== "string") return null;
  return entry as RecommendationErrorEntry;
}

function readRecommendationJob(formDoc: any): RecommendationJobEntry | null {
  const c = formDoc?.content;
  if (!c || typeof c !== "object") return null;
  const entry = (c as any).__recommendationJob;
  if (!entry || typeof entry !== "object") return null;
  if (typeof (entry as any).forUpdatedAt !== "string") return null;
  if (typeof (entry as any).forKey !== "string") return null;
  if (typeof (entry as any).startedAt !== "string") return null;
  const p = (entry as any).progress;
  if (!p || typeof p !== "object") return null;
  if (typeof (p as any).percent !== "number") return null;
  if (typeof (p as any).updatedAt !== "string") return null;
  return entry as RecommendationJobEntry;
}

async function persistRecommendationJob(params: {
  formId: string;
  entry: RecommendationJobEntry;
}) {
  await FormModel.updateOne({ _id: params.formId }, { $set: { "content.__recommendationJob": params.entry } }).exec();
}

async function clearRecommendationJob(formId: string) {
  await FormModel.updateOne({ _id: formId }, { $unset: { "content.__recommendationJob": "" } }).exec();
}

function stableStringify(value: any): string {
  const seen = new WeakSet();
  const walk = (v: any): any => {
    if (v === null || v === undefined) return v;
    if (typeof v !== "object") return v;
    if (seen.has(v)) return null;
    seen.add(v);
    if (Array.isArray(v)) return v.map(walk);
    const keys = Object.keys(v).sort();
    const out: Record<string, any> = {};
    for (const k of keys) out[k] = walk(v[k]);
    return out;
  };
  return JSON.stringify(walk(value));
}

function pickRecommendationInput(params: { formType: string; content: Record<string, any> }) {
  const c = params.content ?? {};
  const scores = c.scores && typeof c.scores === "object" && !Array.isArray(c.scores) ? c.scores : {};
  const totalScore = (scores as any).totalScore ?? null;
  const rank = (scores as any).rank ?? null;
  const subjectsSelected = Array.isArray((scores as any).subjectsSelected) ? (scores as any).subjectsSelected : [];
  const majorPreferences = Array.isArray(c.majorPreferences) ? c.majorPreferences : [];
  return {
    type: params.formType,
    scores: { totalScore, rank, subjectsSelected },
    majorPreferences
  };
}

function getRecommendationKey(input: any): string {
  const text = stableStringify(input);
  return crypto.createHash("sha256").update(text).digest("hex");
}

async function pickFirstExistingPath(candidates: string[]): Promise<string | null> {
  for (const p of candidates) {
    try {
      await fs.access(p);
      return p;
    } catch {
      // continue
    }
  }
  return null;
}

async function resolveScriptPath(): Promise<string> {
  const name = "recommend_engine.R";
  const candidates = [
    path.resolve(__dirname, "../../../scripts", name),
    path.resolve(__dirname, "../../scripts", name),
    path.resolve(process.cwd(), "scripts", name),
    path.resolve(process.cwd(), "server", "scripts", name)
  ];
  const found = await pickFirstExistingPath(candidates);
  if (!found) {
    throw new AppError(
      500,
      "推荐引擎脚本不存在：请确保 recommend_engine.R 已随部署发布到 server/scripts/（或当前运行目录 scripts/）"
    );
  }
  return found;
}

async function resolveDataPaths(): Promise<{ data1: string; data2: string }> {
  const f1 = "admission_training_data_01.xlsx";
  const f2 = "admission_training_data_02.xlsx";
  const bases = [
    path.resolve(__dirname, "../../../data"),
    path.resolve(__dirname, "../../data"),
    path.resolve(process.cwd(), "data"),
    path.resolve(process.cwd(), "server", "data")
  ];
  const candidates1 = bases.map((b) => path.join(b, f1));
  const candidates2 = bases.map((b) => path.join(b, f2));
  const data1 = await pickFirstExistingPath(candidates1);
  const data2 = await pickFirstExistingPath(candidates2);
  if (!data1 || !data2) {
    throw new AppError(
      500,
      "训练数据文件不存在：请确保 admission_training_data_01.xlsx 与 admission_training_data_02.xlsx 已随部署发布到 server/data/（或当前运行目录 data/）"
    );
  }
  return { data1, data2 };
}

function tailText(text: string, maxChars: number) {
  const s = String(text ?? "");
  if (s.length <= maxChars) return s;
  return s.slice(s.length - maxChars);
}

function startRscript(params: {
  scriptPath: string;
  data1: string;
  data2: string;
  inputPath: string;
  onProgress?: (p: { percent: number; step?: string }) => void;
}) {
  const args = [params.scriptPath, "--input", params.inputPath, "--data1", params.data1, "--data2", params.data2];
  const proc = spawn(process.env.RSCRIPT_BIN ?? "Rscript", args, { stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  let stderrLineBuf = "";
  const done = new Promise<string>((resolve, reject) => {
    let stdout = "";
    proc.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    proc.stderr.on("data", (chunk) => {
      const s = String(chunk);
      stderr += s;
      if (stderr.length > 20000) stderr = tailText(stderr, 20000);
      if (params.onProgress) {
        stderrLineBuf += s;
        const parts = stderrLineBuf.split(/\r?\n/);
        stderrLineBuf = parts.pop() ?? "";
        for (const line of parts) {
          const m = line.match(/^PROGRESS\s+(\d{1,3})(?:\s+(.*))?$/);
          if (!m) continue;
          const percent = Math.max(0, Math.min(100, Number(m[1] ?? 0)));
          const step = String(m[2] ?? "").trim() || undefined;
          params.onProgress({ percent, step });
        }
      }
    });
    proc.on("error", (err) => reject(err));
    proc.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `Rscript exited with code ${code}`));
    });
  });
  return { proc, done, getStderrTail: (maxChars = 3000) => tailText(stderr, maxChars) };
}

async function startRecommendationEngine(content: RecommendInput, opts?: { onProgress?: (p: { percent: number; step?: string }) => void }): Promise<{
  proc: import("child_process").ChildProcess;
  done: Promise<RecommendationEngineResponse>;
  getStderrTail: (maxChars?: number) => string;
}> {
  const tmpFile = path.join(os.tmpdir(), `recommend_input_${Date.now()}_${Math.random().toString(36).slice(2)}.json`);
  await fs.writeFile(tmpFile, JSON.stringify(content ?? {}, null, 2), "utf8");

  const rscriptBin = process.env.RSCRIPT_BIN ?? "Rscript";
  try {
    const scriptPath = await resolveScriptPath();
    const { data1, data2 } = await resolveDataPaths();
    const { proc, done, getStderrTail } = startRscript({
      scriptPath,
      data1,
      data2,
      inputPath: tmpFile,
      onProgress: opts?.onProgress
    });

    const parsedDone = (async () => {
      try {
        const raw = await done;
        const jsonText = extractJsonObject(raw);
        const parsed = JSON.parse(jsonText) as RecommendationEngineResponse;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("推荐结果不是 JSON 对象");
        }
        if (parsed.ok !== true) {
          throw new Error("推荐引擎返回 ok=false");
        }
        if (!Array.isArray(parsed.items)) {
          throw new Error("推荐结果格式不正确");
        }
        return parsed;
      } finally {
        await fs.rm(tmpFile, { force: true });
      }
    })();

    return { proc, done: parsedDone, getStderrTail };
  } catch (err: any) {
    await fs.rm(tmpFile, { force: true });
    const code = String(err?.code ?? "");
    if (code === "ENOENT") {
      throw new AppError(
        500,
        `推荐引擎执行失败：未找到 Rscript 可执行文件（spawn ${rscriptBin} ENOENT）。请在服务器运行环境安装 R，并在应用环境变量中设置 RSCRIPT_BIN 指向 Rscript 的完整路径。`
      );
    }
    throw new AppError(500, `推荐引擎执行失败：${err?.message || "未知错误"}`);
  }
}

function extractJsonObject(text: string): string {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return trimmed;
  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
    return trimmed;
  }
}

export async function recommend(content: RecommendInput): Promise<RecommendationEngineResponse> {
  const { done } = await startRecommendationEngine(content);
  return await done;
}

async function getFormForUser(formId: string, userId: string) {
  if (!mongoose.isValidObjectId(formId)) throw new AppError(400, "Invalid input");
  if (!mongoose.isValidObjectId(userId)) throw new AppError(401, "Unauthorized");
  const found = await FormModel.findOne({ _id: formId, userId }).exec();
  if (!found) throw new AppError(404, "表单不存在");
  return found;
}

async function getFormForAdmin(formId: string) {
  if (!mongoose.isValidObjectId(formId)) throw new AppError(400, "Invalid input");
  const found = await FormModel.findById(formId).exec();
  if (!found) throw new AppError(404, "表单不存在");
  return found;
}

export async function getRecommendationStatus(params: {
  formId: string;
  role: "user" | "admin";
  userId?: string;
}): Promise<RecommendationStatusResponse> {
  const formId = normalizeId(params.formId);
  if (!formId) throw new AppError(400, "Invalid input");
  const doc =
    params.role === "admin"
      ? await getFormForAdmin(formId)
      : await getFormForUser(formId, String(params.userId ?? ""));

  const updatedAt = getUpdatedAtIso(doc);
  const input = pickRecommendationInput({ formType: String(doc.type ?? ""), content: doc.content as any });
  const key = getRecommendationKey(input);
  const cache = readRecommendationCache(doc);
  const cacheOk =
    cache &&
    cache.result?.ok === true &&
    Array.isArray(cache.result.items) &&
    (cache.forKey ? cache.forKey === key : cache.forUpdatedAt === updatedAt);
  if (cacheOk) {
    return { ok: true, status: "done", result: cache.result };
  }
  const error = readRecommendationError(doc);
  const errOk = error && error.message.trim() && (error.forKey ? error.forKey === key : error.forUpdatedAt === updatedAt);
  if (errOk) {
    return { ok: true, status: "failed", message: error.message };
  }
  const job = runningJobs.get(formId);
  if (job) {
    const progress = job.progress ? { percent: job.progress.percent, step: job.progress.step } : undefined;
    return { ok: true, status: "pending", progress };
  }
  const persistedJob = readRecommendationJob(doc);
  if (persistedJob && persistedJob.forKey === key) {
    return {
      ok: true,
      status: "pending",
      progress: { percent: persistedJob.progress.percent, step: persistedJob.progress.step }
    };
  }
  return { ok: true, status: "none" };
}

export async function requestRecommendation(params: {
  formId: string;
  role: "user" | "admin";
  userId?: string;
  contentOverride?: Record<string, any>;
}): Promise<RecommendationStatusResponse> {
  const formId = normalizeId(params.formId);
  if (!formId) throw new AppError(400, "Invalid input");

  const doc =
    params.role === "admin"
      ? await getFormForAdmin(formId)
      : await getFormForUser(formId, String(params.userId ?? ""));

  const updatedAt = getUpdatedAtIso(doc);
  const cache = readRecommendationCache(doc);
  const baseContent =
    params.contentOverride && typeof params.contentOverride === "object" ? params.contentOverride : (doc.content as any);
  const input = pickRecommendationInput({ formType: String(doc.type ?? ""), content: baseContent as any });
  const key = getRecommendationKey(input);

  const cacheOk =
    cache &&
    cache.result?.ok === true &&
    Array.isArray(cache.result.items) &&
    (cache.forKey ? cache.forKey === key : cache.forUpdatedAt === updatedAt);
  if (cacheOk) {
    return { ok: true, status: "done", result: cache.result };
  }
  const error = readRecommendationError(doc);
  const errOk = error && error.message.trim() && (error.forKey ? error.forKey === key : error.forUpdatedAt === updatedAt);
  if (errOk) {
    return { ok: true, status: "failed", message: error.message };
  }

  const existingJob = runningJobs.get(formId);
  if (existingJob) {
    const progress = existingJob.progress ? { percent: existingJob.progress.percent, step: existingJob.progress.step } : undefined;
    return { ok: true, status: "pending", progress };
  }

  const engine = await startRecommendationEngine(input as Record<string, any>, {
    onProgress: (p) => {
      const job = runningJobs.get(formId);
      if (!job || job.canceled) return;
      job.progress = { percent: p.percent, step: p.step, updatedAt: Date.now() };
      const now = Date.now();
      const last = job.lastPersistAt ?? 0;
      if (now - last < 1500) return;
      job.lastPersistAt = now;
      const entry: RecommendationJobEntry = {
        forUpdatedAt: updatedAt,
        forKey: key,
        startedAt: new Date(job.startedAt).toISOString(),
        progress: {
          percent: p.percent,
          step: p.step,
          updatedAt: new Date().toISOString()
        }
      };
      persistRecommendationJob({ formId, entry }).catch(() => {});
    }
  });
  const startedAt = Date.now();
  runningJobs.set(formId, { startedAt, proc: engine.proc, canceled: false, progress: { percent: 1, updatedAt: Date.now() } });
  await persistRecommendationJob({
    formId,
    entry: {
      forUpdatedAt: updatedAt,
      forKey: key,
      startedAt: new Date(startedAt).toISOString(),
      progress: { percent: 1, step: "启动推荐脚本", updatedAt: new Date().toISOString() }
    }
  });

  let settled = false;

  const timeoutTimer = setTimeout(() => {
    const job = runningJobs.get(formId);
    if (!job || job.canceled || settled) return;
    const tail = engine.getStderrTail(2500);
    const msg = `推荐生成超时（${RECOMMEND_TIMEOUT_MS}ms）` + (tail ? `\n\nRscript stderr (tail):\n${tail}` : "");
    settled = true;
    try {
      job.proc.kill("SIGKILL");
    } catch {
      // ignore
    }
    const entry: RecommendationErrorEntry = {
      forUpdatedAt: updatedAt,
      forKey: key,
      message: msg,
      failedAt: new Date().toISOString()
    };
    const nextContent =
      typeof doc.content === "object" && doc.content !== null && !Array.isArray(doc.content) ? doc.content : {};
    (nextContent as any).__recommendationError = entry;
    delete (nextContent as any).__recommendation;
    doc.content = nextContent;
    doc
      .save()
      .catch(() => {
        // ignore
      })
      .finally(() => {
        clearRecommendationJob(formId).catch(() => {});
        runningJobs.delete(formId);
      });
  }, RECOMMEND_TIMEOUT_MS);

  engine.done
    .then(async (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      const job = runningJobs.get(formId);
      if (job?.canceled) return;
      const entry: RecommendationCacheEntry = {
        forUpdatedAt: updatedAt,
        forKey: key,
        result,
        generatedAt: new Date().toISOString()
      };
      const nextContent =
        typeof doc.content === "object" && doc.content !== null && !Array.isArray(doc.content) ? doc.content : {};
      (nextContent as any).__recommendation = entry;
      delete (nextContent as any).__recommendationError;
      delete (nextContent as any).__recommendationJob;
      doc.content = nextContent;
      await doc.save();
      await clearRecommendationJob(formId);
    })
    .catch(async (err: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      const job = runningJobs.get(formId);
      if (job?.canceled) return;
      const tail = engine.getStderrTail(2500);
      const baseMsg = String(err?.message || "推荐生成失败");
      const message = tail ? `${baseMsg}\n\nRscript stderr (tail):\n${tail}` : baseMsg;
      const entry: RecommendationErrorEntry = {
        forUpdatedAt: updatedAt,
        forKey: key,
        message,
        failedAt: new Date().toISOString()
      };
      const nextContent =
        typeof doc.content === "object" && doc.content !== null && !Array.isArray(doc.content) ? doc.content : {};
      (nextContent as any).__recommendationError = entry;
      delete (nextContent as any).__recommendation;
      delete (nextContent as any).__recommendationJob;
      doc.content = nextContent;
      await doc.save();
      await clearRecommendationJob(formId);
    })
    .finally(() => {
      clearTimeout(timeoutTimer);
      clearRecommendationJob(formId).catch(() => {});
      runningJobs.delete(formId);
    });

  return { ok: true, status: "pending", progress: { percent: 1 } };
}

export async function cancelRecommendation(params: {
  formId: string;
  role: "user" | "admin";
  userId?: string;
}): Promise<{ ok: true; canceled: boolean }> {
  const formId = normalizeId(params.formId);
  if (!formId) throw new AppError(400, "Invalid input");
  if (params.role === "user" && !params.userId) throw new AppError(401, "Unauthorized");

  const job = runningJobs.get(formId);
  if (job?.proc) {
    try {
      job.canceled = true;
      job.proc.kill("SIGKILL");
    } catch {
      // ignore
    } finally {
      runningJobs.delete(formId);
    }
  }

  const doc =
    params.role === "admin"
      ? await getFormForAdmin(formId)
      : await getFormForUser(formId, String(params.userId ?? ""));
  const updatedAt = getUpdatedAtIso(doc);
  const input = pickRecommendationInput({ formType: String(doc.type ?? ""), content: doc.content as any });
  const key = getRecommendationKey(input);
  const nextContent = typeof doc.content === "object" && doc.content !== null && !Array.isArray(doc.content) ? doc.content : {};
  (nextContent as any).__recommendationError = {
    forUpdatedAt: updatedAt,
    forKey: key,
    message: "用户中止",
    failedAt: new Date().toISOString()
  } as RecommendationErrorEntry;
  delete (nextContent as any).__recommendation;
  delete (nextContent as any).__recommendationJob;
  doc.content = nextContent;
  await doc.save();
  await clearRecommendationJob(formId);
  return { ok: true, canceled: true };
}
