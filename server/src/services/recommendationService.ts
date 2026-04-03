import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { spawn } from "child_process";

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
  | { ok: true; status: "pending" }
  | { ok: true; status: "none" };

type RecommendationCacheEntry = {
  forUpdatedAt: string;
  result: RecommendationEngineResponse;
  generatedAt: string;
};

type RecommendationErrorEntry = {
  forUpdatedAt: string;
  message: string;
  failedAt: string;
};

type RunningJob = {
  startedAt: number;
  proc: import("child_process").ChildProcess;
  canceled: boolean;
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

function startRscript(params: { scriptPath: string; data1: string; data2: string; inputPath: string }) {
  const args = [params.scriptPath, "--input", params.inputPath, "--data1", params.data1, "--data2", params.data2];
  const proc = spawn(process.env.RSCRIPT_BIN ?? "Rscript", args, { stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  const done = new Promise<string>((resolve, reject) => {
    let stdout = "";
    proc.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    proc.stderr.on("data", (chunk) => {
      stderr += String(chunk);
      if (stderr.length > 20000) stderr = tailText(stderr, 20000);
    });
    proc.on("error", (err) => reject(err));
    proc.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `Rscript exited with code ${code}`));
    });
  });
  return { proc, done, getStderrTail: (maxChars = 3000) => tailText(stderr, maxChars) };
}

async function startRecommendationEngine(content: RecommendInput): Promise<{
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
    const { proc, done, getStderrTail } = startRscript({ scriptPath, data1, data2, inputPath: tmpFile });

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
  const cache = readRecommendationCache(doc);
  if (cache && cache.forUpdatedAt === updatedAt && cache.result?.ok === true && Array.isArray(cache.result.items)) {
    return { ok: true, status: "done", result: cache.result };
  }
  const error = readRecommendationError(doc);
  if (error && error.forUpdatedAt === updatedAt && error.message.trim()) {
    return { ok: true, status: "failed", message: error.message };
  }
  if (runningJobs.has(formId)) return { ok: true, status: "pending" };
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
  if (cache && cache.forUpdatedAt === updatedAt && cache.result?.ok === true && Array.isArray(cache.result.items)) {
    return { ok: true, status: "done", result: cache.result };
  }
  const error = readRecommendationError(doc);
  if (error && error.forUpdatedAt === updatedAt && error.message.trim()) {
    return { ok: true, status: "failed", message: error.message };
  }

  if (runningJobs.has(formId)) return { ok: true, status: "pending" };

  const content =
    params.contentOverride && typeof params.contentOverride === "object" ? params.contentOverride : (doc.content as any);

  const engine = await startRecommendationEngine(content as Record<string, any>);
  const startedAt = Date.now();
  runningJobs.set(formId, { startedAt, proc: engine.proc, canceled: false });

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
    const entry: RecommendationErrorEntry = { forUpdatedAt: updatedAt, message: msg, failedAt: new Date().toISOString() };
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
      const entry: RecommendationCacheEntry = { forUpdatedAt: updatedAt, result, generatedAt: new Date().toISOString() };
      const nextContent =
        typeof doc.content === "object" && doc.content !== null && !Array.isArray(doc.content) ? doc.content : {};
      (nextContent as any).__recommendation = entry;
      delete (nextContent as any).__recommendationError;
      doc.content = nextContent;
      await doc.save();
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
      const entry: RecommendationErrorEntry = { forUpdatedAt: updatedAt, message, failedAt: new Date().toISOString() };
      const nextContent =
        typeof doc.content === "object" && doc.content !== null && !Array.isArray(doc.content) ? doc.content : {};
      (nextContent as any).__recommendationError = entry;
      delete (nextContent as any).__recommendation;
      doc.content = nextContent;
      await doc.save();
    })
    .finally(() => {
      clearTimeout(timeoutTimer);
      runningJobs.delete(formId);
    });

  return { ok: true, status: "pending" };
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
  const nextContent = typeof doc.content === "object" && doc.content !== null && !Array.isArray(doc.content) ? doc.content : {};
  (nextContent as any).__recommendationError = {
    forUpdatedAt: updatedAt,
    message: "用户中止",
    failedAt: new Date().toISOString()
  } as RecommendationErrorEntry;
  delete (nextContent as any).__recommendation;
  doc.content = nextContent;
  await doc.save();
  return { ok: true, canceled: true };
}
