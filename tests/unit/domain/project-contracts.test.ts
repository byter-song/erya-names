import { describe, expect, it } from "vitest";
import { createProjectId } from "../../../src/domain/shared/ids";
import {
  familyRulesArePending,
  namingProfileSchema,
} from "../../../src/domain/project/profile";
import { namingProjectSchema } from "../../../src/domain/project/project";
import { generationBatchSchema } from "../../../src/domain/generation/batch";
import { candidateSchema } from "../../../src/domain/candidate/candidate";
import { candidateDecisionSchema } from "../../../src/domain/candidate/decision";

describe("production domain contracts", () => {
  it("parses a complete Song surname naming profile", () => {
    const projectId = createProjectId("project-song");
    const profile = namingProfileSchema.parse({
      projectId,
      surname: "宋",
      surnameType: "single",
      givenNameLength: 2,
      requiredCharacters: [],
      generationCharacters: [],
      avoidCharacters: ["病"],
      relativeNames: [],
      forbiddenCombinations: [],
      genderExpression: "unrestricted",
      styleTags: ["清朗自然"],
      writingComplexity: "balanced",
      pinyinFriendly: true,
      folklore: { enabled: false, usefulElements: [], includeInRanking: false },
    });

    expect(profile.surname).toBe("宋");
    expect(profile.givenNameLength).toBe(2);
    expect(familyRulesArePending(profile)).toBe(true);
  });

  it("rejects conflicting required positions for a one-character given name", () => {
    expect(() =>
      namingProfileSchema.parse({
        projectId: "project-song",
        surname: "宋",
        surnameType: "single",
        givenNameLength: 1,
        requiredCharacters: [{ char: "清", position: 2 }],
        generationCharacters: [],
        avoidCharacters: [],
        relativeNames: [],
        forbiddenCombinations: [],
        genderExpression: "unrestricted",
        styleTags: [],
        writingComplexity: "balanced",
        pinyinFriendly: false,
        folklore: { enabled: false, usefulElements: [], includeInRanking: false },
      }),
    ).toThrow("一字名不能把指定字固定在第二位");
  });

  it("models project, immutable batch, candidate, and compatible decision stages", () => {
    expect(
      namingProjectSchema.parse({
        id: "project-song",
        title: "宋姓宝宝起名",
        stage: "generation",
        status: "active",
        createdAt: "2026-09-17T00:00:00.000Z",
        updatedAt: "2026-09-17T00:00:00.000Z",
      }).title,
    ).toBe("宋姓宝宝起名");

    expect(
      generationBatchSchema.parse({
        id: "batch-1",
        projectId: "project-song",
        sequence: 1,
        seed: "seed-1",
        requestedCount: 24,
        profileSnapshot: { surname: "宋" },
        datasetVersion: "dev-1",
        rulePackVersion: "rules-1",
        status: "completed",
        statistics: {
          sourceCandidates: 40,
          hardRejected: 10,
          duplicateRejected: 4,
          historicalRejected: 2,
          persisted: 24,
        },
        createdAt: "2026-09-17T00:00:00.000Z",
      }).sequence,
    ).toBe(1);

    expect(
      candidateSchema.parse({
        id: "candidate-1",
        projectId: "project-song",
        batchId: "batch-1",
        normalizedFingerprint: "宋清扬",
        surname: "宋",
        givenName: "清扬",
        fullName: "宋清扬",
        pinyin: ["sòng", "qīng", "yáng"],
        sourceType: "verified_allusion",
        summary: "清澈明朗，意气飞扬",
        createdAt: "2026-09-17T00:00:00.000Z",
      }).sourceType,
    ).toBe("verified_allusion");

    expect(
      candidateDecisionSchema.parse({
        candidateId: "candidate-1",
        projectId: "project-song",
        stage: "favorite",
        updatedAt: "2026-09-17T00:00:00.000Z",
      }).stage,
    ).toBe("favorite");
    expect(
      candidateDecisionSchema.parse({
        candidateId: "candidate-2",
        projectId: "project-song",
        stage: "folklore_review",
        updatedAt: "2026-09-17T00:00:00.000Z",
      }).stage,
    ).toBe("folklore_review");
  });
});
