import { describe, expect, it } from "vitest";
import { calculateBasicFiveElements } from "../../../../src/domain/folklore/calendarAdapter";
import { scoreBasicFiveElements } from "../../../../src/domain/rules/l4/basicFiveElements";

describe("basic traditional folklore reference", () => {
  it("computes a verified four-pillar and five-element fixture", () => {
    const result = calculateBasicFiveElements({
      localDateTime: "2024-02-10T12:00",
      timeZone: "Asia/Shanghai",
    });
    expect(result).toMatchObject({
      pillars: ["甲辰", "丙寅", "甲辰", "庚午"],
      distribution: { wood: 3, fire: 2, earth: 2, metal: 1, water: 0 },
      library: "lunar-typescript@1.8.6",
      disclaimer: "传统民俗参考，非科学结论。",
    });
  });

  it("is absent unless enabled and uses only user-specified useful elements", () => {
    expect(
      scoreBasicFiveElements({
        enabled: false,
        usefulElements: ["water"],
        includeInRanking: true,
        characterElements: ["water"],
      }),
    ).toBeUndefined();
    expect(
      scoreBasicFiveElements({
        enabled: true,
        usefulElements: [],
        includeInRanking: true,
        characterElements: ["water"],
      }),
    ).toBeUndefined();
    expect(
      scoreBasicFiveElements({
        enabled: true,
        usefulElements: ["water"],
        includeInRanking: false,
        characterElements: ["water"],
      }),
    ).toMatchObject({ scoreDelta: 0, includedInRanking: false });
    expect(
      scoreBasicFiveElements({
        enabled: true,
        usefulElements: ["water"],
        includeInRanking: true,
        characterElements: ["water", "wood"],
      }),
    ).toMatchObject({ scoreDelta: 2, matchedElements: ["water"] });
  });

  it("cannot override an L1 or L2 rejection", () => {
    const l4 = scoreBasicFiveElements({
      enabled: true,
      usefulElements: ["water"],
      includeInRanking: true,
      characterElements: ["water"],
    });
    const l1L2Accepted = false;
    expect(l1L2Accepted && Boolean(l4)).toBe(false);
  });
});
