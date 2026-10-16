import { describe, expect, it } from "vitest";
import { evaluateZodiacHints } from "../../../../src/domain/folklore/zodiacAdvisory";
import { evaluateTraditionalNaming } from "../../../../src/domain/folklore/traditionalNaming";

describe("zodiac and traditional naming rules", () => {
  it("keeps zodiac matches as soft advice and never emits a filter or hard conflict", () => {
    const result = evaluateZodiacHints({
      givenName: "逸安",
      zodiac: "龙",
      rules: [
        {
          id: "dragon-start-yi",
          zodiac: "龙",
          position: "start",
          characters: ["逸"],
          direction: "avoid",
          deduction: 8,
          explanation: "部分生肖姓名流派把该字形列为提醒。",
          sourceId: "zodiac-source-1",
        },
      ],
    });

    expect(result.hits).toHaveLength(1);
    expect(result.deduction).toBe(8);
    expect(result.hardStatus).toBe("notice");
    expect("filtered" in result).toBe(false);
  });

  it("does not deduct when a name has no 信义象假类 interpretation tag", () => {
    const result = evaluateTraditionalNaming({
      fullName: "宋清扬",
      principleTags: [],
      tabooRules: [],
    });

    expect(result.principleTags).toEqual([]);
    expect(result.deduction).toBe(0);
  });

  it("caps literal six-taboo deductions at fifteen points", () => {
    const result = evaluateTraditionalNaming({
      fullName: "国山币兽",
      principleTags: ["象"],
      tabooRules: [
        { id: "country", terms: ["国"], label: "国名", sourceId: "zuozhuan-1" },
        { id: "landform", terms: ["山"], label: "山川", sourceId: "zuozhuan-1" },
        { id: "currency", terms: ["币"], label: "器币", sourceId: "zuozhuan-1" },
        { id: "animal", terms: ["兽"], label: "畜生", sourceId: "zuozhuan-1" },
      ],
    });

    expect(result.hits).toHaveLength(4);
    expect(result.deduction).toBe(15);
    expect(result.hardStatus).toBe("notice");
  });

  it("matches multi-character taboo terms exactly instead of splitting them into characters", () => {
    const rules = [{ id: "office", terms: ["司徒"], label: "官职", sourceId: "zuozhuan-1" }];

    expect(
      evaluateTraditionalNaming({ fullName: "司徒", principleTags: [], tabooRules: rules })
        .deduction,
    ).toBe(5);
    expect(
      evaluateTraditionalNaming({ fullName: "司衡", principleTags: [], tabooRules: rules })
        .deduction,
    ).toBe(0);
  });
});
