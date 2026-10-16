export function namingProfileFixture(projectId = "project-song") {
  return {
    projectId,
    configRevision: 0,
    basics: {
      surname: "宋",
      surnameType: "single" as const,
      givenNameLength: 2 as const,
      genderExpression: "unrestricted" as const,
      styleTags: [],
      writingComplexity: "balanced" as const,
      pinyinFriendly: false,
    },
    family: {
      constraintKnowledge: "none" as const,
      requiredCharacters: [],
      generationCharacters: [],
      avoidCharacters: [],
      relativeNames: [],
      forbiddenCombinations: [],
    },
    inspiration: { sources: ["poetry", "modern"] as ("poetry" | "modern" | "historical")[] },
    calendar: {
      timeKnown: false,
      timeZone: "Asia/Shanghai",
      dayBoundary: "midnight" as const,
      zodiacConvention: "lunar" as const,
      trueSolarTimeCorrection: "not_applied" as const,
      historicalDstCorrection: "not_applied" as const,
    },
    modules: {
      bazi_wuxing: disabledModule("bazi-wuxing-none", "bazi-wuxing-0"),
      zodiac: disabledModule("zodiac-radical-hints-v1", "zodiac-radical-hints-v1"),
      traditional: disabledModule(
        "zuozhuan-naming-principles-v1",
        "zuozhuan-naming-principles-v1",
      ),
      name_hexagram: disabledModule("meihua-name-stroke-erya-v1", "meihua-relation-score-v1"),
      five_grids: disabledModule("kumasaki-five-grid-1930-ndl-v1", "kumasaki-score-map-v1"),
    },
    scoring: { presetId: "basic", presetVersion: "1", basicWeight: 100 },
  };
}

function disabledModule(schoolId: string, ruleVersion: string) {
  return {
    analysisEnabled: false,
    detailsVisible: false,
    weight: 0,
    schoolId,
    ruleVersion,
  };
}
