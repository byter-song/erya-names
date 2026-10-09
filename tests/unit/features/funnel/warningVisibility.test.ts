import { describe, expect, it } from "vitest";
import { cardLevelWarnings } from "../../../../src/features/funnel/warningVisibility";

const pronunciationWarning = {
  ruleId: "l2-multiple-pronunciation",
  ruleVersion: "1",
  explanation: "存在多个字典读音",
  sourceRefs: ["pinyin-data"],
};

describe("cardLevelWarnings", () => {
  it("keeps everyday pronunciation ambiguity on the card", () => {
    expect(cardLevelWarnings({ givenName: "乐宁", warnings: [pronunciationWarning] })).toEqual([
      pronunciationWarning,
    ]);
  });

  it("leaves rare dictionary readings for the detail view", () => {
    expect(cardLevelWarnings({ givenName: "明诚", warnings: [pronunciationWarning] })).toEqual(
      [],
    );
  });

  it("never hides non-pronunciation risks", () => {
    const homophone = { ...pronunciationWarning, ruleId: "l2-known-homophone" };
    expect(cardLevelWarnings({ givenName: "明诚", warnings: [homophone] })).toEqual([
      homophone,
    ]);
  });
});
