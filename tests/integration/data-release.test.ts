import { describe, expect, it } from "vitest";
import { auditReleaseInput, buildRuntimeBundle } from "../../scripts/data/release";
import { applyReviewDecisions } from "../../scripts/data/apply-review";

const review = {
  decision: "approve" as const,
  reviewer: "human-a@",
  reviewedAt: "2026-09-18T00:00:00.000Z",
  sourceChecked: true,
  semanticNote: "语义已核",
  riskNote: "风险已核",
};
const character = {
  id: "character:6e05",
  char: "清",
  pinyin: ["qīng"],
  meanings: ["清澈、纯净"],
  styleTags: ["清朗自然"],
  risks: [],
  riskSignals: [],
  reviewStatus: "verified",
  sourceRefs: [{ sourceId: "standard-hanzi-2013", location: "一级字表" }],
  primaryReview: review,
  secondaryReview: { ...review, reviewer: "human-b@", decision: "approve" },
};
const allusion = {
  id: "allusion-qingyang",
  title: "有美一人",
  work: "诗经",
  quote: "有美一人，清扬婉兮。",
  selectedText: "清扬",
  interpretation: "清秀明朗，神采飞扬。",
  styleTags: ["清朗自然"],
  risks: [],
  riskSignals: [],
  reviewStatus: "verified",
  sourceRefs: [{ sourceId: "chinese-poetry", location: "诗经·郑风" }],
  primaryReview: review,
  secondaryReview: { ...review, reviewer: "human-b@", decision: "approve" },
};
const sources = [
  { sourceId: "standard-hanzi-2013", releaseEligible: true },
  { sourceId: "chinese-poetry", releaseEligible: true },
];

describe("production data release", () => {
  it("fails below production character and allusion thresholds", () => {
    const audit = auditReleaseInput({
      characters: [character],
      allusions: [allusion],
      sources,
    });
    expect(audit.ok).toBe(false);
    expect(audit.errors).toEqual(
      expect.arrayContaining([expect.stringContaining("800"), expect.stringContaining("300")]),
    );
  });

  it("fails unknown sources, missing human review, invalid Unicode and duplicate stable IDs", () => {
    const audit = auditReleaseInput(
      {
        characters: [
          { ...character, char: "\ud800", primaryReview: undefined },
          { ...character },
        ],
        allusions: [{ ...allusion, sourceRefs: [{ sourceId: "unknown", location: "x" }] }],
        sources,
      },
      { minCharacters: 1, maxCharacters: 10, minAllusions: 1, maxAllusions: 10 },
    );
    expect(audit.ok).toBe(false);
    expect(audit.errors.join(" | ")).toMatch(/duplicate|source|review|Unicode/i);
  });

  it("rejects invalid or non-NFC Unicode in allusion runtime text", () => {
    const audit = auditReleaseInput(
      {
        characters: [character],
        allusions: [{ ...allusion, quote: "bad\ud800", selectedText: "e\u0301" }],
        sources,
      },
      { minCharacters: 1, maxCharacters: 10, minAllusions: 1, maxAllusions: 10 },
    );
    expect(audit.ok).toBe(false);
    expect(audit.errors.join(" | ")).toMatch(/Unicode|NFC/i);
  });

  it("requires secondary review for high-risk records and a ten-percent normal sample", () => {
    const noSecondary = { ...character, secondaryReview: undefined };
    const highRisk = {
      ...noSecondary,
      id: "character:884c",
      char: "行",
      riskSignals: [
        {
          kind: "multiple_pronunciation",
          outcome: "warn",
          explanation: "多音",
          sourceRefs: ["pinyin-data"],
          reviewStatus: "verified",
        },
      ],
    };
    const audit = auditReleaseInput(
      {
        characters: [highRisk, noSecondary],
        allusions: [allusion],
        sources: [...sources, { sourceId: "pinyin-data", releaseEligible: true }],
      },
      { minCharacters: 1, maxCharacters: 10, minAllusions: 1, maxAllusions: 10 },
    );
    expect(audit.ok).toBe(false);
    expect(audit.errors.join(" | ")).toMatch(/secondary/i);
  });

  it("does not count dispute, retire or source-request decisions as an approving secondary review", () => {
    for (const decision of ["dispute", "retire", "request-source"] as const) {
      const audit = auditReleaseInput(
        {
          characters: [
            {
              ...character,
              riskSignals: [
                {
                  kind: "multiple_pronunciation",
                  outcome: "warn",
                  explanation: "多音",
                  sourceRefs: ["pinyin-data"],
                  reviewStatus: "verified",
                },
              ],
              secondaryReview: { ...review, reviewer: "human-b@", decision },
            },
          ],
          allusions: [allusion],
          sources: [...sources, { sourceId: "pinyin-data", releaseEligible: true }],
        },
        { minCharacters: 1, maxCharacters: 10, minAllusions: 1, maxAllusions: 10 },
      );
      expect(audit.ok).toBe(false);
      expect(audit.errors.join(" | ")).toMatch(/secondary/i);
    }
  });

  it("rejects release records whose primary review omits an approving decision", () => {
    const audit = auditReleaseInput(
      {
        characters: [
          {
            ...character,
            primaryReview: {
              reviewer: review.reviewer,
              reviewedAt: review.reviewedAt,
              sourceChecked: review.sourceChecked,
              semanticNote: review.semanticNote,
              riskNote: review.riskNote,
            },
          },
        ],
        allusions: [allusion],
        sources,
      },
      { minCharacters: 1, maxCharacters: 10, minAllusions: 1, maxAllusions: 10 },
    );
    expect(audit.ok).toBe(false);
    expect(audit.errors.join(" | ")).toMatch(/primary review/i);
  });

  it("builds a deterministic production bundle with manifest hash and source summary", () => {
    const first = buildRuntimeBundle(
      {
        characters: [character],
        allusions: [allusion],
        sources,
        version: "2026.09.18",
        releasedAt: "2026-09-18T00:00:00.000Z",
        changelog: ["Initial reviewed release"],
      },
      { minCharacters: 1, maxCharacters: 10, minAllusions: 1, maxAllusions: 10 },
    );
    const second = buildRuntimeBundle(
      {
        characters: [character],
        allusions: [allusion],
        sources,
        version: "2026.09.18",
        releasedAt: "2026-09-18T00:00:00.000Z",
        changelog: ["Initial reviewed release"],
      },
      { minCharacters: 1, maxCharacters: 10, minAllusions: 1, maxAllusions: 10 },
    );
    expect(first).toEqual(second);
    expect(first.manifest).toMatchObject({
      status: "production",
      version: "2026.09.18",
      counts: { characters: 1, allusions: 1 },
    });
    expect(first.manifest.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.manifest.builtAt).toBe("2026-09-18T00:00:00.000Z");
    expect(JSON.stringify(first)).not.toContain("human-a@");
    for (const internalField of [
      "primaryReview",
      "secondaryReview",
      "review",
      "machineSuggestion",
      "sourceRecordId",
      "normalizedQuote",
    ]) {
      expect(first).not.toHaveProperty(`characters.0.${internalField}`);
      expect(first).not.toHaveProperty(`allusions.0.${internalField}`);
    }
  });

  it("accepts the real G3 approved output and emits only runtime-whitelisted fields", () => {
    const candidate = {
      id: "allusion-candidate:real",
      sourceRecordId: "source:1",
      sourceId: "chinese-poetry:shijing",
      work: "诗经",
      title: "野有蔓草",
      location: "郑风",
      quote: "有美一人，清扬婉兮。",
      normalizedQuote: "有美一人，清扬婉兮。",
      selectedText: "清扬",
      reviewStatus: "unreviewed" as const,
      machineSuggestion: { interpretation: "", risks: [] },
    };
    const primary = {
      candidateId: candidate.id,
      decision: "edit-and-approve",
      reviewStage: "primary",
      reviewer: { id: "human-a@", kind: "human" },
      reviewedAt: "2026-09-18T00:00:00.000Z",
      sourceChecked: true,
      semanticNote: "上下文已核",
      riskNote: "风险已核",
      edits: { interpretation: "清秀明朗，神采飞扬。", styleTags: ["清朗自然"], risks: [] },
    };
    const secondary = {
      ...primary,
      reviewStage: "secondary",
      reviewer: { id: "human-b@", kind: "human" },
      reviewedAt: "2026-09-18T01:00:00.000Z",
    };
    const approved = applyReviewDecisions([candidate], [primary, secondary]).approved;
    const bundle = buildRuntimeBundle(
      {
        characters: [character],
        allusions: approved,
        sources,
        version: "2026.09.18",
        releasedAt: "2026-09-18T00:00:00.000Z",
        changelog: ["G3 to G4"],
      },
      { minCharacters: 1, maxCharacters: 10, minAllusions: 1, maxAllusions: 10 },
    );
    expect(bundle.allusions[0]).toEqual({
      id: candidate.id,
      title: "野有蔓草",
      work: "诗经",
      quote: "有美一人，清扬婉兮。",
      selectedText: "清扬",
      interpretation: "清秀明朗，神采飞扬。",
      styleTags: ["清朗自然"],
      risks: [],
      riskSignals: [],
      reviewStatus: "verified",
      sourceRefs: [
        { sourceId: "chinese-poetry", location: "郑风", excerpt: "有美一人，清扬婉兮。" },
      ],
    });
  });
});
