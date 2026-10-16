import type { FiveElement } from "./fiveElements";

type Line = 0 | 1;
type TrigramPosition = "upper" | "lower";

export interface NameHexagramInput {
  surnameStrokes: number[];
  givenNameStrokes: number[];
}

export interface Trigram {
  id: string;
  name: string;
  number: number;
  linesBottomToTop: readonly [Line, Line, Line];
  element: FiveElement;
}

const trigrams: readonly Trigram[] = [
  { id: "heaven", name: "乾", number: 1, linesBottomToTop: [1, 1, 1], element: "metal" },
  { id: "lake", name: "兑", number: 2, linesBottomToTop: [1, 1, 0], element: "metal" },
  { id: "fire", name: "离", number: 3, linesBottomToTop: [1, 0, 1], element: "fire" },
  { id: "thunder", name: "震", number: 4, linesBottomToTop: [1, 0, 0], element: "wood" },
  { id: "wind", name: "巽", number: 5, linesBottomToTop: [0, 1, 1], element: "wood" },
  { id: "water", name: "坎", number: 6, linesBottomToTop: [0, 1, 0], element: "water" },
  { id: "mountain", name: "艮", number: 7, linesBottomToTop: [0, 0, 1], element: "earth" },
  { id: "earth", name: "坤", number: 8, linesBottomToTop: [0, 0, 0], element: "earth" },
];

const generates: Record<FiveElement, FiveElement> = {
  wood: "fire",
  fire: "earth",
  earth: "metal",
  metal: "water",
  water: "wood",
};

const controls: Record<FiveElement, FiveElement> = {
  wood: "earth",
  fire: "metal",
  earth: "water",
  metal: "wood",
  water: "fire",
};

function positiveModulo(value: number, divisor: number): number {
  const remainder = value % divisor;
  return remainder === 0 ? divisor : remainder;
}

function requireStrokeList(label: string, values: number[]): void {
  if (
    !values.length ||
    values.some((value) => !Number.isInteger(value) || value < 1 || value > 64)
  )
    throw new Error(`${label}笔画必须是 1–64 的整数且不能为空`);
}

function trigramByNumber(number: number): Trigram {
  const trigram = trigrams.find((item) => item.number === number);
  if (!trigram) throw new Error("无法映射八卦序号");
  return trigram;
}

function changedTrigram(source: Trigram, localLine: number): Trigram {
  const lines = [...source.linesBottomToTop] as [Line, Line, Line];
  lines[localLine - 1] = lines[localLine - 1] === 1 ? 0 : 1;
  const changed = trigrams.find((item) =>
    item.linesBottomToTop.every((line, index) => line === lines[index]),
  );
  if (!changed) throw new Error("无法生成变卦");
  return changed;
}

function relation(body: FiveElement, use: FiveElement, phase: "original" | "changed") {
  const scale = phase === "original" ? 1 : 0.5;
  if (body === use) return { id: "same_element" as const, deduction: 0 };
  if (generates[use] === body) return { id: "use_generates_body" as const, deduction: 0 };
  if (controls[body] === use) return { id: "body_controls_use" as const, deduction: 6 * scale };
  if (generates[body] === use)
    return { id: "body_generates_use" as const, deduction: 14 * scale };
  return { id: "use_controls_body" as const, deduction: 24 * scale };
}

export function calculateNameHexagram(input: NameHexagramInput) {
  requireStrokeList("姓氏", input.surnameStrokes);
  requireStrokeList("名字", input.givenNameStrokes);
  const upperInput = input.surnameStrokes.reduce((sum, value) => sum + value, 0);
  const lowerInput = input.givenNameStrokes.reduce((sum, value) => sum + value, 0);
  const upper = trigramByNumber(positiveModulo(upperInput, 8));
  const lower = trigramByNumber(positiveModulo(lowerInput, 8));
  const movingLine = positiveModulo(upperInput + lowerInput, 6);
  const use: TrigramPosition = movingLine <= 3 ? "lower" : "upper";
  const body: TrigramPosition = use === "lower" ? "upper" : "lower";
  const changed = {
    upper: use === "upper" ? changedTrigram(upper, movingLine - 3) : upper,
    lower: use === "lower" ? changedTrigram(lower, movingLine) : lower,
  };
  const originalRelation = relation(
    (body === "upper" ? upper : lower).element,
    (use === "upper" ? upper : lower).element,
    "original",
  );
  const changedRelation = relation(
    (body === "upper" ? changed.upper : changed.lower).element,
    (use === "upper" ? changed.upper : changed.lower).element,
    "changed",
  );

  return {
    original: { upper, lower },
    changed,
    movingLine,
    bodyUse: { body, use },
    relations: { original: originalRelation, changed: changedRelation },
    deduction: originalRelation.deduction + changedRelation.deduction,
    score: Math.max(0, 100 - originalRelation.deduction - changedRelation.deduction),
    methodId: "meihua-name-stroke-erya-v1",
    scoreMapId: "meihua-relation-score-v1",
    calculation: [
      `上卦输入：${input.surnameStrokes.join("+")}=${upperInput}；除 8 余数映射为 ${upper.number}（${upper.name}）`,
      `下卦输入：${input.givenNameStrokes.join("+")}=${lowerInput}；除 8 余数映射为 ${lower.number}（${lower.name}）`,
      `动爻：(${upperInput}+${lowerInput}) 除 6，余数映射为第 ${movingLine} 爻`,
      `第 ${movingLine} 爻所在的${use === "upper" ? "上卦" : "下卦"}为用，翻转该爻得到变卦`,
    ],
    reviewStatus: "research_only" as const,
    disclaimer: "按所选姓名卦象流派计算；姓名分组公式是尔雅产品约定，结论随口径变化。",
  };
}
