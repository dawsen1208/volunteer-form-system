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

async function runRscript(inputPath: string): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const script = getScriptPath();
    const proc = spawn("Rscript", [script, "--input", inputPath], {
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
    const raw = await runRscript(tmpFile);
    await fs.rm(tmpFile, { force: true });
    const parsed = JSON.parse(raw) as RecommendResult;
    if (!parsed || !Array.isArray(parsed.items)) {
      throw new Error("推荐结果格式不正确");
    }
    return parsed;
  } catch (err: any) {
    await fs.rm(tmpFile, { force: true });
    throw new AppError(500, `推荐引擎执行失败：${err?.message || "未知错误"}`);
  }
}
