import { normalizePinyin, readSurname } from "../../candidate/nameReading";
import type { CandidateRuleResult } from "../types";
const knownRisks: Record<string, string> = {
  duziteng: "肚子疼",
  wuli: "无礼",
  shizhenxiang: "屎真香",
  fantong: "饭桶",
  hulijing: "狐狸精",
  jiazhenjing: "假正经",
  yangwei: "阳痿",
  danyan: "单眼",
};
export function evaluateFullNameSound(
  surname: string,
  pinyin: string[],
  override?: string,
): CandidateRuleResult[] {
  const full = normalizePinyin([...readSurname(surname, override), ...pinyin]);
  const phrase = knownRisks[full];
  return phrase
    ? [
        {
          evidenceLevel: "L2",
          outcome: "warn",
          ruleId: "l2-full-name-homophone",
          ruleVersion: "full-name-2",
          sourceRefs: ["erya-original-20260927"],
          explanation: `普通话去声调后与“${phrase}”同音，建议家人全名试读并确认；这只是有限的常见谐音提示。`,
          scoreDelta: -8,
        },
      ]
    : [];
}
