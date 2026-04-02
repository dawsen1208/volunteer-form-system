import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { spawn } from "child_process";

import { AppError } from "../utils/errors";

type RecommendInput = Record<string, any>;

export type RecommendationEngineResponse = {
  ok: boolean;
  mode?: string;
  formType?: string;
  items: Array<Record<string, any>>;
  [key: string]: any;
};

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

async function runRscript(scriptPath: string, data1: string, data2: string, inputPath: string): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const args = [scriptPath, "--input", inputPath, "--data1", data1, "--data2", data2];
    const proc = spawn(process.env.RSCRIPT_BIN ?? "Rscript", args, {
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    proc.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    proc.on("error", (err) => {
      reject(err);
    });
    proc.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `Rscript exited with code ${code}`));
    });
  });
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
  const tmpFile = path.join(os.tmpdir(), `recommend_input_${Date.now()}.json`);
  const rscriptBin = process.env.RSCRIPT_BIN ?? "Rscript";

  // Write input
  await fs.writeFile(tmpFile, JSON.stringify(content ?? {}, null, 2), "utf8");

  try {
    const scriptPath = await resolveScriptPath();
    const { data1, data2 } = await resolveDataPaths();
    const raw = await runRscript(scriptPath, data1, data2, tmpFile);
    await fs.rm(tmpFile, { force: true });
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
