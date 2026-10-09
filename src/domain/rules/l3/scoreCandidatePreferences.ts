import { normalizePinyin } from "../../candidate/nameReading";
import { createSystemScoreBaseRule } from "../scoring/systemScore";
export interface L3Dimension {
  id: string;
  outcome: "score" | "unknown";
  scoreDelta: number;
  evidence: string;
}

export function scoreCandidatePreferences(input: {
  pinyin: string[];
  sourceType: "verified_allusion" | "modern_combination" | "user_input";
  characterStyleTags: string[];
  preferredStyleTags: string[];
  pinyinFriendly: boolean;
}) {
  const styleMatches = input.preferredStyleTags.filter((tag) =>
    input.characterStyleTags.includes(tag),
  );
  const normalizedSyllables = input.pinyin.map((value) => normalizePinyin([value]));
  const repeatedSyllables = new Set(normalizedSyllables).size !== normalizedSyllables.length;
  const scoreBase = createSystemScoreBaseRule();
  const dimensions: L3Dimension[] = [
    {
      id: "score-base",
      outcome: "score",
      scoreDelta: scoreBase.scoreDelta ?? 0,
      evidence: scoreBase.explanation,
    },
    {
      id: "style-match",
      outcome: "score",
      scoreDelta:
        input.preferredStyleTags.length === 0
          ? 0
          : styleMatches.length === 0
            ? -4
            : Math.min(styleMatches.length * 3, 6),
      evidence: styleMatches.length
        ? `匹配偏好：${styleMatches.join("、")}`
        : input.preferredStyleTags.length
          ? `未匹配已选择风格：${input.preferredStyleTags.join("、")}，作为软偏好扣分。`
          : "当前方案未选择风格偏好",
    },
    {
      id: "source-quality",
      outcome: "score",
      scoreDelta:
        input.sourceType === "verified_allusion"
          ? 4
          : input.sourceType === "modern_combination"
            ? 2
            : 0,
      evidence:
        input.sourceType === "verified_allusion"
          ? "古籍原句取字"
          : input.sourceType === "modern_combination"
            ? "来自有来源的字卡组合"
            : "用户手工录入",
    },
    {
      id: "pinyin-friendly",
      outcome: "score",
      scoreDelta: input.pinyinFriendly ? (repeatedSyllables ? -4 : 2) : 0,
      evidence: !input.pinyinFriendly
        ? "当前方案未启用拼音友好偏好"
        : repeatedSyllables
          ? "存在重复音节，日常呼叫辨识度可能下降，作为软偏好扣分"
          : "拼音音节无重复",
    },
    {
      id: "shape-balance",
      outcome: "unknown",
      scoreDelta: 0,
      evidence: "当前数据包没有可校准字形结构数据",
    },
    {
      id: "commonness",
      outcome: "unknown",
      scoreDelta: 0,
      evidence: "当前数据包没有可校准新生儿使用频率",
    },
  ];
  return { total: dimensions.reduce((sum, item) => sum + item.scoreDelta, 0), dimensions };
}
