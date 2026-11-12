/**
 * scripts/report-io.mjs —— 派生报告的**幂等写入**（同一输入恒得同一读数）。
 *
 * 背景（DEF-0013）：报告含 wall-clock `ts`，若每次都刷新，则「同一输入」产出不同文件，
 * 违反方法论的「可复算」要求，并令 `npm run release` 永远留下脏工作区。
 *
 * 规则：**内容（除 `ts` 外）不变则保留既有 `ts`**；有实质变化才更新 `ts`。
 * 非 JSON（如 md）按原文幂等写入。
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

function stripTs(obj) {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    const { ts, ...rest } = obj;
    return rest;
  }
  return obj;
}

/** 写入 JSON 报告：内容稳定则保留旧 ts；否则用 now 作新 ts。返回 true＝有实质变化。 */
export function writeReportJson(outPath, obj) {
  mkdirSync(dirname(outPath), { recursive: true });
  let ts = obj.ts ?? new Date().toISOString();
  if (existsSync(outPath)) {
    try {
      const prev = JSON.parse(readFileSync(outPath, "utf8"));
      if (JSON.stringify(stripTs(prev)) === JSON.stringify(stripTs(obj))) {
        ts = prev.ts ?? ts; // 内容不变 → 保留旧 ts（幂等）
      }
    } catch {
      /* 旧件不可解析 → 视作有变化 */
    }
  }
  const next = { ...obj, ts };
  const text = JSON.stringify(next, null, 2);
  const changed = !existsSync(outPath) || readFileSync(outPath, "utf8") !== text;
  if (changed) writeFileSync(outPath, text, "utf8");
  return changed;
}

/** 写入文本报告（md）的幂等版本。返回 true＝有实质变化。 */
export function writeReportText(outPath, text) {
  mkdirSync(dirname(outPath), { recursive: true });
  const changed = !existsSync(outPath) || readFileSync(outPath, "utf8") !== text;
  if (changed) writeFileSync(outPath, text, "utf8");
  return changed;
}
