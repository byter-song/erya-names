import { describe, expect, it } from "vitest";
import { scoreCandidatePreferences } from "../../../../src/domain/rules/l3/scoreCandidatePreferences";

describe("L3 explainable scoring", () => {
  it("scores enabled evidence and returns neutral unknown dimensions", () => {
    const result = scoreCandidatePreferences({
      pinyin: ["sòng", "qīng", "yáng"],
      sourceType: "verified_allusion",
      characterStyleTags: ["清朗自然", "文雅书卷"],
      preferredStyleTags: ["清朗自然"],
      pinyinFriendly: true,
    });
    expect(result.total).toBeGreaterThan(0);
    expect(result.dimensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "score-base",
          outcome: "score",
          scoreDelta: 60,
        }),
        expect.objectContaining({
          id: "style-match",
          outcome: "score",
          evidence: expect.any(String),
        }),
        expect.objectContaining({ id: "shape-balance", outcome: "unknown", scoreDelta: 0 }),
        expect.objectContaining({ id: "commonness", outcome: "unknown", scoreDelta: 0 }),
      ]),
    );
    expect(result.total).toBe(
      result.dimensions.reduce((sum, item) => sum + item.scoreDelta, 0),
    );
    expect(result.total).toBeGreaterThanOrEqual(60);
    expect(result.total).toBeLessThanOrEqual(100);
  });
});
