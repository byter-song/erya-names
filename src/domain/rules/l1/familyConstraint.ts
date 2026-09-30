import type { NamingProfile } from "../../project/profile";
import type { CandidateRuleResult } from "../types";

const RULE_VERSION = "l1-family-constraint-1";

export function evaluateFamilyConstraints(input: {
  fullName: string;
  givenName: string;
  profile: NamingProfile;
}): CandidateRuleResult {
  const failures: string[] = [];
  const nameCharacters = [...input.givenName];

  if (!input.fullName.startsWith(input.profile.surname)) failures.push("姓氏不一致");
  if (nameCharacters.length !== input.profile.givenNameLength) failures.push("名字长度不符");
  if (input.profile.avoidCharacters.some((char) => input.givenName.includes(char)))
    failures.push("包含避字");
  if (input.profile.forbiddenCombinations.includes(input.givenName))
    failures.push("命中禁用组合");
  if (input.profile.relativeNames.includes(input.fullName)) failures.push("与亲属姓名重复");
  if (
    input.profile.requiredCharacters.some(({ char, position }) =>
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
