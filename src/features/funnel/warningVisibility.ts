import type {
  CandidateFunnelItem,
  CandidateWarningEvidence,
} from "../../application/models/CandidateFunnelItem";

// These characters have common name-use readings that materially affect how a family
// will introduce or call the child. Rarer dictionary readings remain in the detail view.
const everydayPronunciationAmbiguities = new Set([
  "珩",
  "行",
  "乐",
  "宁",
  "予",
  "朝",
  "柏",
  "朴",
  "藏",
  "见",
  "和",
]);

export function cardLevelWarnings(
  candidate: Pick<CandidateFunnelItem, "givenName" | "warnings">,
): CandidateWarningEvidence[] {
  return candidate.warnings.filter(
    (warning) =>
      warning.ruleId !== "l2-multiple-pronunciation" ||
      [...(candidate.givenName ?? "")].some((char) =>
        everydayPronunciationAmbiguities.has(char),
      ),
  );
}
