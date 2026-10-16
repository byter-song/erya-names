import { describe, expect, it } from "vitest";
import {
  familyRulesArePending,
  namingProfileSchema,
} from "../../../src/domain/project/profile";
import { namingProjectSchema } from "../../../src/domain/project/project";
import { generationBatchSchema } from "../../../src/domain/generation/batch";
import { candidateSchema } from "../../../src/domain/candidate/candidate";
import { candidateDecisionSchema } from "../../../src/domain/candidate/decision";
import { namingProfileFixture } from "../../fixtures/namingProfile";

describe("production domain contracts", () => {
  it("parses a complete Song surname naming profile", () => {
    const projectId = "project-song";
    const profile = namingProfileSchema.parse({
      ...namingProfileFixture(projectId),
      basics: {
        ...namingProfileFixture(projectId).basics,
        styleTags: ["清朗自然"],
        pinyinFriendly: true,
      },
      family: {
        ...namingProfileFixture(projectId).family,
        constraintKnowledge: "unknown",
        avoidCharacters: ["病"],
      },
    });

    expect(profile.basics.surname).toBe("宋");
    expect(profile.basics.givenNameLength).toBe(2);
    expect(familyRulesArePending(profile.family)).toBe(true);
  });

  it("rejects conflicting required positions for a one-character given name", () => {
    expect(() =>
      namingProfileSchema.parse({
        ...namingProfileFixture(),
        basics: { ...namingProfileFixture().basics, givenNameLength: 1 },
        family: {
          ...namingProfileFixture().family,
          requiredCharacters: [{ char: "清", position: 2 }],
        },
      }),
    ).toThrow("一字名不能把指定字固定在第二位");
  });

  it("models project, immutable batch, candidate, and strict candidate pools", () => {
    expect(
      namingProjectSchema.parse({
        id: "project-song",
        title: "宋姓宝宝起名",
        stage: "naming",
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
        pool: "selected",
        updatedAt: "2026-09-17T00:00:00.000Z",
      }).pool,
    ).toBe("selected");
    expect(
      candidateDecisionSchema.parse({
        candidateId: "candidate-2",
        projectId: "project-song",
        pool: "excluded",
        lastActivePool: "candidate",
        exclusionReason: "家庭讨论后暂不考虑",
        excludedAt: "2026-09-17T00:00:00.000Z",
        updatedAt: "2026-09-17T00:00:00.000Z",
      }).pool,
    ).toBe("excluded");
  });
});
