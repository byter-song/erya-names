import { describe, expect, it } from "vitest";
import {
  CORPUS_ACCEPTANCE_THRESHOLD,
  scoreAllusionRecord,
} from "../../../scripts/data/corpusScoring.mjs";

describe("allusion corpus scoring", () => {
  it("keeps a clear and low-risk two-character extraction at full score", () => {
    expect(
      scoreAllusionRecord({
        selectedText: "清扬",
        contextRisk: "low",
        semanticClarity: 5,
        nameUsability: 5,
        ambiguousReadings: 0,
        maximumStrokes: 12,
      }),
    ).toMatchObject({ total: 100, accepted: true, deductions: [] });
  });

  it("records explicit deductions and rejects a low-scoring record", () => {
    const result = scoreAllusionRecord({
      selectedText: "行",
      contextRisk: "high",
      semanticClarity: 1,
      nameUsability: 1,
      ambiguousReadings: 2,
      maximumStrokes: 21,
    });

    expect(result.total).toBeLessThan(CORPUS_ACCEPTANCE_THRESHOLD);
    expect(result.accepted).toBe(false);
    expect(result.deductions.map((item: { id: string }) => item.id)).toEqual([
      "context-risk",
      "semantic-clarity",
      "name-usability",
      "multiple-pronunciation",
      "writing-complexity",
      "single-character-extraction",
    ]);
  });

  it("rejects incomplete editorial ratings instead of guessing", () => {
    expect(() =>
      scoreAllusionRecord({
        selectedText: "清扬",
        contextRisk: "unknown",
        semanticClarity: 5,
        nameUsability: 5,
      }),
    ).toThrow("Invalid contextRisk");
  });
});
