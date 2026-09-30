import type { PersonUsage } from "../../data/schema/runtimeBundle";

/** 人物记录只用于完整姓名的同名提示，不做分词、模糊匹配或评分。 */
export function matchPersonUsages(
  fullName: string,
  personUsages: readonly PersonUsage[],
): PersonUsage[] {
  return personUsages.filter((usage) => usage.name === fullName);
}
