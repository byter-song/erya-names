import { describe, expect, it } from "vitest";
import { deriveAllusionCandidates } from "../../../scripts/data/derive/allusions";
import { deriveCharacterCandidates } from "../../../scripts/data/derive/characters";

describe("review candidate derivation", () => {
  it("emits deterministic unreviewed character candidates sorted by stable id", () => {
    const result = deriveCharacterCandidates({
      standardCharacters: "清扬知远",
      pinyin: new Map([
        ["清", ["qīng"]],
        ["扬", ["yáng"]],
      ]),
      corpusTexts: ["知远清扬清"],
    });
    expect(result.map((entry) => entry.id)).toEqual(
      [...result.map((entry) => entry.id)].sort(),
    );
    expect(result.every((entry) => entry.reviewStatus === "unreviewed")).toBe(true);
    expect(result.find((entry) => entry.char === "清")?.frequency).toBe(2);
  });

  it("emits deterministic allusion fragments without self-approval", () => {
    const result = deriveAllusionCandidates(
      [
        {
          id: "source:1",
          sourceId: "shijing",
          work: "诗经",
          title: "野有蔓草",
          location: "郑风",
          originalText: "有美一人，清扬婉兮。",
          normalizedText: "有美一人，清扬婉兮。",
        },
      ],
      new Set(["清", "扬", "婉"]),
    );
    expect(result.map((entry) => entry.id)).toEqual(
      [...result.map((entry) => entry.id)].sort(),
    );
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          selectedText: "清扬",
          reviewStatus: "unreviewed",
          machineSuggestion: expect.any(Object),
        }),
      ]),
    );
    expect(result.some((entry) => entry.reviewStatus === "verified")).toBe(false);
  });
});
