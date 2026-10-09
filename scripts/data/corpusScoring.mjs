export const CORPUS_SCORING_MODEL_VERSION = "corpus-score-1";
export const CORPUS_ACCEPTANCE_THRESHOLD = 70;

const contextDeductions = {
  low: 0,
  medium: 10,
  high: 24,
};

export function scoreAllusionRecord(input) {
  const contextRisk = parseContextRisk(input.contextRisk);
  const semanticClarity = parseRating(input.semanticClarity, "semanticClarity");
  const nameUsability = parseRating(input.nameUsability, "nameUsability");
  const deductions = [];

  addDeduction(
    deductions,
    "context-risk",
    contextDeductions[contextRisk],
    contextRisk === "high"
      ? "原篇存在较强的哀伤、征役、讽刺、祭祀或冲突语境，需要在详情中显著说明。"
      : "原篇语境需要和取名引申分开说明，避免把局部字面当成整篇结论。",
  );
  addDeduction(
    deductions,
    "semantic-clarity",
    (5 - semanticClarity) * 4,
    "现代取名释义与原文关系不够直接，降低语义清晰度得分。",
  );
  addDeduction(
    deductions,
    "name-usability",
    (5 - nameUsability) * 3,
    "作为现代姓名的读写、搭配或日常称呼成本较高。",
  );

  const ambiguousReadings = Math.max(0, Number(input.ambiguousReadings ?? 0));
  addDeduction(
    deductions,
    "multiple-pronunciation",
    Math.min(12, ambiguousReadings * 4),
    "所选字包含需要家庭确认的多音读法。",
  );

  const maximumStrokes = Math.max(0, Number(input.maximumStrokes ?? 0));
  addDeduction(
    deductions,
    "writing-complexity",
    maximumStrokes > 20 ? 5 : maximumStrokes > 16 ? 2 : 0,
    "所选字笔画较多，日常书写成本偏高。",
  );

  addDeduction(
    deductions,
    "single-character-extraction",
    [...input.selectedText].length === 1 ? 3 : 0,
    "单字取名可组合信息较少，需要结合姓氏单独判断。",
  );

  const total = clamp(100 - deductions.reduce((sum, item) => sum + item.points, 0), 0, 100);
  return {
    total,
    threshold: CORPUS_ACCEPTANCE_THRESHOLD,
    accepted: total >= CORPUS_ACCEPTANCE_THRESHOLD,
    deductions,
    modelVersion: CORPUS_SCORING_MODEL_VERSION,
  };
}

function parseContextRisk(value) {
  if (value === "low" || value === "medium" || value === "high") return value;
  throw new Error(`Invalid contextRisk: ${value}`);
}

function parseRating(value, field) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5)
    throw new Error(`${field} must be an integer from 1 to 5`);
  return parsed;
}

function addDeduction(target, id, points, explanation) {
  if (points <= 0) return;
  target.push({ id, points, explanation });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
