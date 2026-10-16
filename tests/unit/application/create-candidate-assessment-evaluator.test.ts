import { describe, expect, it } from "vitest";
import { createCandidateAssessmentEvaluator } from "../../../src/application/services/createCandidateAssessmentEvaluator";
import personalBundle from "../../../src/data/curated/personal-bundle.json";
import { runtimeBundleSchema } from "../../../src/data/schema/runtimeBundle";
import { applyConfigurationPreset } from "../../../src/domain/project/configurationPresets";
import { namingProfileSchema, type NamingProfile } from "../../../src/domain/project/profile";
import { namingProfileFixture } from "../../fixtures/namingProfile";

const candidate = {
  id: "candidate-folklore-core",
  projectId: "project-song",
  batchId: null,
  normalizedFingerprint: "宋明安",
  surname: "宋",
  givenName: "明安",
  fullName: "宋明安",
  pinyin: ["míng", "ān"],
  sourceType: "user_input" as const,
  summary: "民俗核心评分测试",
  createdAt: "2026-10-16T08:00:00.000Z",
};
const bundle = runtimeBundleSchema.parse(personalBundle);

describe("reviewed folklore-core evaluator", () => {
  it("runs bazi, zodiac and traditional scoring from reviewed packs", async () => {
    const profile = folkloreCoreProfile();
    profile.calendar.birthLocalDateTime = "2024-08-08T08:30";
    profile.calendar.timeKnown = true;
    profile.calendar.zodiacConvention = "pillar";
    profile.usefulGodDecision = {
      confirmedElements: ["earth"],
      confirmedAt: "2026-10-16T08:00:00.000Z",
    };

    const result = await createCandidateAssessmentEvaluator(bundle)({
      candidate,
      profile,
      sources: [],
    });
    const evidence = result.replacements.flatMap((replacement) => replacement.evidence);

    for (const moduleId of ["bazi_wuxing", "zodiac", "traditional"] as const) {
      expect(evidence.find((item) => item.moduleId === moduleId)).toMatchObject({
        applicability: "applied",
        schoolId: profile.modules[moduleId].schoolId,
      });
      expect(evidence.find((item) => item.moduleId === moduleId)?.uncertainty).toBeTruthy();
      expect(result.score.moduleScores[moduleId]).toBeDefined();
    }
  });

  it("keeps core modules enabled but exits missing birth decisions from the score denominator", async () => {
    const profile = folkloreCoreProfile();
    const result = await createCandidateAssessmentEvaluator(bundle)({
      candidate,
      profile,
      sources: [],
    });
    const evidence = result.replacements.flatMap((replacement) => replacement.evidence);

    expect(profile.modules.bazi_wuxing.analysisEnabled).toBe(true);
    expect(profile.modules.zodiac.analysisEnabled).toBe(true);
    expect(evidence.find((item) => item.moduleId === "bazi_wuxing")).toMatchObject({
      applicability: "missing_input",
      status: "unknown",
    });
    expect(evidence.find((item) => item.moduleId === "zodiac")).toMatchObject({
      applicability: "missing_input",
      status: "unknown",
    });
    expect(evidence.find((item) => item.moduleId === "traditional")).toMatchObject({
      applicability: "applied",
    });
    expect(result.score.moduleScores.bazi_wuxing).toBeUndefined();
    expect(result.score.moduleScores.zodiac).toBeUndefined();
    expect(result.score.moduleScores.traditional).toBeDefined();
  });
});

function folkloreCoreProfile(): NamingProfile {
  const base = namingProfileSchema.parse(namingProfileFixture());
  const profile = applyConfigurationPreset(base, "traditional-core");
  profile.modules.bazi_wuxing = {
    ...profile.modules.bazi_wuxing,
    detailsVisible: true,
    schoolId: "four-path-useful-god-v1",
    ruleVersion: "1.0.0",
  };
  profile.modules.zodiac = {
    ...profile.modules.zodiac,
    detailsVisible: true,
    schoolId: "zodiac-radical-hints-v1",
    ruleVersion: "1.0.0",
  };
  profile.modules.traditional = {
    ...profile.modules.traditional,
    detailsVisible: true,
    schoolId: "zuozhuan-naming-principles-v1",
    ruleVersion: "1.0.0",
  };
  return namingProfileSchema.parse(profile);
}
