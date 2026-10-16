import { describe, expect, it } from "vitest";
import { calculateNameHexagram } from "../../../../src/domain/folklore/nameHexagram";
import { calculateFiveGrids } from "../../../../src/domain/folklore/fiveGrids";
import { resolveKangxiStrokes } from "../../../../src/domain/folklore/kangxiStrokes";

describe("name hexagram and five-grid formulas", () => {
  it("maps modulo zero to trigram eight and moving line six", () => {
    const result = calculateNameHexagram({ surnameStrokes: [8], givenNameStrokes: [8, 8] });

    expect(result.original.upper.number).toBe(8);
    expect(result.original.lower.number).toBe(8);
    expect(result.movingLine).toBe(6);
  });

  it("marks the moving trigram as use and derives the changed hexagram", () => {
    const result = calculateNameHexagram({ surnameStrokes: [7], givenNameStrokes: [8, 5] });

    expect(result.movingLine).toBe(2);
    expect(result.bodyUse.use).toBe("lower");
    expect(result.changed.lower.number).not.toBe(result.original.lower.number);
    expect(result.calculation.length).toBeGreaterThanOrEqual(3);
  });

  it.each([
    { surname: [7], given: [8, 5], expected: [8, 15, 13, 6, 20] },
    { surname: [7], given: [8], expected: [8, 15, 9, 2, 15] },
    { surname: [9, 7], given: [8, 5], expected: [16, 15, 13, 14, 29] },
    { surname: [9, 7], given: [8], expected: [16, 15, 9, 10, 24] },
  ])("implements all four surname/given-name structures", ({ surname, given, expected }) => {
    expect(calculateFiveGrids(surname, given).map((grid) => grid.value)).toEqual(expected);
  });

  it("returns unknown instead of guessing when any reviewed Kangxi stroke is missing", () => {
    const result = resolveKangxiStrokes("宋𠮷安", [
      { character: "宋", kangxiForm: "宋", strokeCount: 7, reviewStatus: "reviewed" },
      { character: "安", kangxiForm: "安", strokeCount: 6, reviewStatus: "reviewed" },
    ]);

    expect(result.status).toBe("unknown");
    expect(result.missingCharacters).toEqual(["𠮷"]);
  });
});
