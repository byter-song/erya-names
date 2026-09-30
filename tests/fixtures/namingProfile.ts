export function namingProfileFixture(projectId = "project-song") {
  return {
    projectId,
    surname: "宋",
    surnameType: "single" as const,
    givenNameLength: 2 as const,
    requiredCharacters: [],
    generationCharacters: [],
    avoidCharacters: [],
    relativeNames: [],
    forbiddenCombinations: [],
    genderExpression: "unrestricted" as const,
    styleTags: [],
    writingComplexity: "balanced" as const,
    pinyinFriendly: false,
    folklore: { enabled: false, usefulElements: [], includeInRanking: false },
  };
}
