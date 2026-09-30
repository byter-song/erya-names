type Element = "wood" | "fire" | "earth" | "metal" | "water";

export function scoreBasicFiveElements(input: {
  enabled: boolean;
  usefulElements: Element[];
  includeInRanking: boolean;
  characterElements: Element[];
}) {
  if (!input.enabled || input.usefulElements.length === 0) return undefined;
  const matchedElements = [
    ...new Set(
      input.characterElements.filter((element) => input.usefulElements.includes(element)),
    ),
  ];
  return {
    evidenceLevel: "L4" as const,
    ruleId: "l4-user-specified-five-elements",
    ruleVersion: "basic-five-elements-1",
    includedInRanking: input.includeInRanking,
    matchedElements,
    scoreDelta: input.includeInRanking ? matchedElements.length * 2 : 0,
    explanation: `仅按用户指定喜用五行匹配：${matchedElements.join("、") || "无"}。传统民俗参考，非科学结论。`,
  };
}
