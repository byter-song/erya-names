import type { RuntimeBundle } from "../../../data/schema/runtimeBundle";
import standardCharacters from "../../../data/curated/standard-characters.json";
import type { CandidateRuleResult } from "../types";

const RULE_VERSION = "l1-standard-character-1";
const STANDARD_SOURCE_ID = "standard-hanzi-2013";
const officialCharacters = new Set(standardCharacters.characters);
const cachedEntries = new WeakMap<
  RuntimeBundle,
  Map<string, RuntimeBundle["characters"][number]>
>();

export function evaluateStandardCharacters(
  fullName: string,
  givenName: string,
  bundle: RuntimeBundle,
): CandidateRuleResult {
  let entries = cachedEntries.get(bundle);
  if (!entries) {
    entries = new Map(bundle.characters.map((entry) => [entry.char, entry]));
    cachedEntries.set(bundle, entries);
  }
  const unsupported = [...fullName].filter((char) => !officialCharacters.has(char));
  const unreviewedNameCharacters = [...givenName].filter((char) => {
    const entry = entries.get(char);
    return (
      !entry ||
      !(
        entry.reviewStatus === "verified" ||
        (bundle.manifest.status === "personal" && entry.reviewStatus === "source_checked")
      ) ||
      !entry.sourceRefs.some((source) => source.sourceId === STANDARD_SOURCE_ID)
    );
  });

  return {
    ruleId: "l1-standard-character",
    evidenceLevel: "L1",
    outcome: unsupported.length > 0 || unreviewedNameCharacters.length > 0 ? "reject" : "pass",
    explanation:
      unsupported.length > 0
        ? `不在《通用规范汉字表》中：${unsupported.join("、")}`
        : unreviewedNameCharacters.length > 0
          ? `名字用字缺少已复核字卡证据：${unreviewedNameCharacters.join("、")}`
          : "完整姓名通过规范字检测；不替代当地户籍登记确认",
    sourceRefs: [STANDARD_SOURCE_ID],
    scoreDelta: 0,
    ruleVersion: RULE_VERSION,
  };
}
