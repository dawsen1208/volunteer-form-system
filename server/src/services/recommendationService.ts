import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { spawn } from "child_process";

import { AppError } from "../utils/errors";

type RecommendInput = Record<string, any>;

type RecommendResult = {
  items: Array<Record<string, any>>;
  meta?: Record<string, any>;
};

function getScriptPath(): string {
  // ../../scripts/recommend_engine.R relative to this file
  return path.resolve(__dirname, "../../scripts/recommend_engine.R");
}

function getDataPaths(): { data1: string; data2: string } {
  const base = path.resolve(__dirname, "../../data");
  return {
    data1: path.join(base, "admission_training_data_01.xlsx"),
    data2: path.join(base, "admission_training_data_02.xlsx")
  };
}

async function runRscript(inputPath: string): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const script = getScriptPath();
    const { data1, data2 } = getDataPaths();
    const args = [script, "--input", inputPath, "--data1", data1, "--data2", data2];
    const proc = spawn("Rscript", args, {
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

export async function recommend(content: RecommendInput): Promise<RecommendResult> {
  const tmpFile = path.join(os.tmpdir(), `recommend_input_${Date.now()}.json`);
  const scriptPath = getScriptPath();
  const { data1, data2 } = getDataPaths();

  // Write input
  await fs.writeFile(tmpFile, JSON.stringify(content ?? {}, null, 2), "utf8");

  try {
    // Ensure script exists
    await fs.access(scriptPath);
  } catch {
    await fs.rm(tmpFile, { force: true });
    throw new AppError(
      500,
      "推荐引擎脚本不存在：请在 server/scripts/ 下添加 recommend_engine.R"
    );
  }
  try {
    // Ensure data files exist
    await fs.access(data1);
    await fs.access(data2);
  } catch {
    await fs.rm(tmpFile, { force: true });
    throw new AppError(500, "训练数据文件不存在：请在 server/data/ 下添加 admission_training_data_01.xlsx 与 admission_training_data_02.xlsx");
  }

  try {
    const raw = await runRscript(tmpFile);
    await fs.rm(tmpFile, { force: true });
    // R 端可能输出日志，提取最后一个 JSON 对象
    const trimmed = String(raw).trim();
    const start = trimmed.lastIndexOf("{");
    const jsonText = start >= 0 ? trimmed.slice(start) : trimmed;
    const parsed = JSON.parse(jsonText) as RecommendResult;
    if (!parsed || !Array.isArray(parsed.items)) {
      throw new Error("推荐结果格式不正确");
    }
    return parsed;
  } catch (err: any) {
    await fs.rm(tmpFile, { force: true });
    throw new AppError(500, `推荐引擎执行失败：${err?.message || "未知错误"}`);
  }
}
