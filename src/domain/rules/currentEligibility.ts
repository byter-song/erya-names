import { familyRulesArePending, type NamingProfile } from "../project/profile";
import { evaluateFamilyConstraints } from "./l1/familyConstraint";
export function currentEligibility(
  candidate: { fullName: string; givenName: string; pinyin?: string[] },
  profile: NamingProfile,
): string | undefined {
  if (familyRulesArePending(profile)) return "请先核对家庭字辈与避讳";
  if (candidate.fullName !== profile.surname + candidate.givenName)
    return "当前姓氏已变更，请重新生成或录入姓名";
  const result = evaluateFamilyConstraints({ ...candidate, profile });
  return result.outcome === "reject" ? result.explanation : undefined;
}
