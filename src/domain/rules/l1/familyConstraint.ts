import type { NamingProfile } from "../../project/profile";
import type { CandidateRuleResult } from "../types";

const RULE_VERSION = "l1-family-constraint-2";

/** Same syllable regardless of tone; preserve the distinction between u and ü. */
export function familySyllable(value: string): string {
  return value
    .toLowerCase()
    .replace(/[üǖǘǚǜ]/gu, "v")
    .normalize("NFD")
    .replace(/[\u0300-\u036f1-5]/gu, "");
}

export function evaluateFamilyConstraints(input: {
  fullName: string;
  givenName: string;
  pinyin?: string[];
  profile: NamingProfile;
}): CandidateRuleResult {
  const failures: string[] = [];
  const nameCharacters = [...input.givenName];
  const { basics, family } = input.profile;

  if (!input.fullName.startsWith(basics.surname)) failures.push("姓氏不一致");
  if (nameCharacters.length !== basics.givenNameLength) failures.push("名字长度不符");
  if (family.avoidCharacters.some((char) => input.givenName.includes(char)))
    failures.push("包含避字");
  if (family.forbiddenCombinations.includes(input.givenName)) failures.push("命中禁用组合");
  if (family.relativeNames.includes(input.fullName)) failures.push("与亲属姓名重复");
  for (const rule of family.relativeAvoidances ?? []) {
    if (rule.mode === "whole-name" && rule.fullName === input.fullName)
      failures.push(`与亲属${rule.fullName}整名相同`);
    if (rule.mode === "same-character") {
      const shared = nameCharacters.filter((char) => rule.givenName.includes(char));
      if (shared.length)
        failures.push(`与亲属${rule.fullName}的名同字：${[...new Set(shared)].join("、")}`);
    }
    if (rule.mode === "same-sound") {
      if (input.pinyin?.length !== nameCharacters.length) {
        failures.push("缺少完整读音，无法核对已设置的亲属同音避讳");
        continue;
      }
      const syllables = new Set(rule.pinyin.map(familySyllable));
      const shared = input.pinyin.filter((syllable) => syllables.has(familySyllable(syllable)));
      if (shared.length)
        failures.push(`与亲属${rule.fullName}的名同音（不分声调）：${shared.join("、")}`);
    }
  }
  if (
    family.requiredCharacters.some(({ char, position }) =>
      position === "any"
        ? !input.givenName.includes(char)
        : nameCharacters[position - 1] !== char,
    )
  )
    failures.push("不满足指定字或固定位置");

  return {
    ruleId: "l1-family-constraint",
    evidenceLevel: "L1",
    outcome: failures.length > 0 ? "reject" : "pass",
    explanation:
      failures.length > 0 ? `家庭硬约束未通过：${failures.join("；")}` : "家庭硬约束已通过",
    sourceRefs: [],
    scoreDelta: 0,
    ruleVersion: RULE_VERSION,
  };
}
