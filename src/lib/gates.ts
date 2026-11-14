/**
 * src/lib/gates.ts —— 六道门禁 G1–G6 的纯函数判据。
 *
 * 边界：只依赖标准库；入参为项目状态快照（ProjectState）。
 * 关键：区分 pass/block/visible/na；判定对象不存在时报 na，绝不判为 pass。
 * block/visible 必须带 remedy（Linter 即 Prompt）。
 * 自省字段 examined / unrecognized 必填（§10.1 登记面自省）。
 */

export type Verdict = "pass" | "block" | "visible" | "na";

export interface GateReading {
  readonly id: string;
  readonly verdict: Verdict;
  /** 判定对象数。 */
  readonly examined: number;
  /** 未识别形态数。 */
  readonly unrecognized: number;
  /** 补救指令（block/visible 必带）。 */
  readonly remedy?: string;
}

/** 门禁判据唯一入参：项目状态快照。各子对象缺失即该门禁 na。 */
export interface ProjectState {
  readonly requirements?: {
    readonly frozen: boolean;
    readonly openRulings: number;
  };
  readonly architecture?: {
    readonly techStack: boolean;
    readonly dependencies: boolean;
    readonly directory: boolean;
    readonly environment: boolean;
  };
  readonly designTree?: {
    /** 同构对账失败数。 */
    readonly isomorphicMismatches: number;
    /** 命令注册表双向核对失败数。 */
    readonly commandRegistryMismatches: number;
  };
  readonly testTree?: {
    /** 有文件级设计但缺对应用例文档的源文件数。 */
    readonly missingCoverage: number;
  };
  readonly landings?: {
    readonly items: ReadonlyArray<{
      readonly id: string;
      readonly existsBytes: number;
      readonly schemaValid: boolean;
      readonly whitelisted: boolean;
    }>;
  };
  readonly wrapup?: {
    readonly tempOpen: number;
    readonly boardActive: number;
    readonly versionPlaces: number;
    /** 缺陷登记册存在且可解析。 */
    readonly defectsRegister?: boolean;
  };
}

function reading(id: string, verdict: Verdict, examined: number, unrecognized: number, remedy?: string): GateReading {
  return remedy === undefined ? { id, verdict, examined, unrecognized } : { id, verdict, examined, unrecognized, remedy };
}

export const gates = {
  /** G1 需求冻结：需求件 frozen 且裁决无未决项。 */
  G1(s: ProjectState): GateReading {
    const r = s.requirements;
    if (!r) return reading("G1", "na", 0, 0);
    const examined = 2;
    if (r.frozen && r.openRulings === 0) return reading("G1", "pass", examined, 0);
    return reading("G1", "block", examined, 0, "需求件须 status: frozen 且裁决记录无未决项；先关闭未决项再冻结。");
  },

  /** G2 架构就位：ARCHITECTURE.md 含四类内容。 */
  G2(s: ProjectState): GateReading {
    const a = s.architecture;
    if (!a) return reading("G2", "na", 0, 0);
    const examined = 4;
    const missing = [a.techStack, a.dependencies, a.directory, a.environment].filter((v) => !v).length;
    if (missing === 0) return reading("G2", "pass", examined, 0);
    return reading("G2", "block", examined, 0, `ARCHITECTURE.md 缺 ${missing} 类内容（技术栈/核心依赖/目录结构/环境探查）。`);
  },

  /** G3 设计树同构：同构对账 + 命令注册表双向核对均零失败。 */
  G3(s: ProjectState): GateReading {
    const d = s.designTree;
    if (!d) return reading("G3", "na", 0, 0);
    const examined = d.isomorphicMismatches + d.commandRegistryMismatches;
    if (d.isomorphicMismatches === 0 && d.commandRegistryMismatches === 0) return reading("G3", "pass", examined, 0);
    return reading("G3", "block", examined, 0, "同构或命令注册表对账失败；先修到零失败。");
  },

  /** G4 测试树覆盖：文件级设计均有对应用例文档。 */
  G4(s: ProjectState): GateReading {
    const t = s.testTree;
    if (!t) return reading("G4", "na", 0, 0);
    const examined = t.missingCoverage + 1;
    if (t.missingCoverage === 0) return reading("G4", "pass", examined, 0);
    return reading("G4", "block", examined, 0, `有 ${t.missingCoverage} 个源文件缺对应用例文档；先补测试树。`);
  },

  /** G5 落地非空：交付件存在且大于十字节、schema 合法、在白名单。 */
  G5(s: ProjectState): GateReading {
    const l = s.landings;
    if (!l || l.items.length === 0) return reading("G5", "na", 0, 0);
    let bad = 0;
    for (const it of l.items) {
      if (!(it.existsBytes > 10) || !it.schemaValid || !it.whitelisted) bad++;
    }
    if (bad === 0) return reading("G5", "pass", l.items.length, 0);
    return reading("G5", "block", l.items.length, 0, `${bad} 件落地不合格（空/超短/schema 非法/不在白名单）。`);
  },

  /** G6 收尾清空：临时件清空、看板活跃投影为空、版本落三处。 */
  G6(s: ProjectState): GateReading {
    const w = s.wrapup;
    if (!w) return reading("G6", "na", 0, 0);
    const examined = 4;
    if (w.tempOpen === 0 && w.boardActive === 0 && w.versionPlaces === 3 && w.defectsRegister === true) return reading("G6", "pass", examined, 0);
    const parts: string[] = [];
    if (w.tempOpen !== 0) parts.push(`临时件未清 ${w.tempOpen}`);
    if (w.boardActive !== 0) parts.push(`看板活跃 ${w.boardActive}`);
    if (w.versionPlaces !== 3) parts.push(`版本落点 ${w.versionPlaces}/3`);
    if (w.defectsRegister !== true) parts.push("缺陷登记册缺失或损坏");
    return reading("G6", "block", examined, 0, `收尾未清空（${parts.join("，")}）；清空后方可收尾。`);
  },
} as const;

export function summarize(readings: readonly GateReading[]): { pass: number; block: number; visible: number; na: number } {
  const out = { pass: 0, block: 0, visible: 0, na: 0 };
  for (const r of readings) out[r.verdict]++;
  return out;
}

/** block 为零即可推进（na 不阻塞推进，但也不等于通过）。 */
export function canAdvance(readings: readonly GateReading[]): boolean {
  return readings.every((r) => r.verdict !== "block");
}
