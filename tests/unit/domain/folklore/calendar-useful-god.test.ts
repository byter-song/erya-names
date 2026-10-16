import { describe, expect, it } from "vitest";
import { calculateBasicFiveElements } from "../../../../src/domain/folklore/calendarAdapter";
import { analyzeUsefulGod } from "../../../../src/domain/folklore/usefulGod";

describe("calendar and useful-god contracts", () => {
  it("changes the exact year pillar at the published 2024 Start of Spring boundary", () => {
    const before = calculateBasicFiveElements({
      localDateTime: "2024-02-04T16:20",
      timeZone: "Asia/Shanghai",
      dayBoundary: "midnight",
      timeKnown: true,
    });
    const after = calculateBasicFiveElements({
      localDateTime: "2024-02-04T16:30",
      timeZone: "Asia/Shanghai",
      dayBoundary: "midnight",
      timeKnown: true,
    });

    expect(before.pillars[0]).not.toBe(after.pillars[0]);
    expect(after.previousJie.name).toBe("立春");
  });

  it("returns only three pillars and explicit uncertainty when birth time is unknown", () => {
    const result = calculateBasicFiveElements({
      localDateTime: "2024-08-08",
      timeZone: "Asia/Shanghai",
      dayBoundary: "midnight",
      timeKnown: false,
    });

    expect(result.pillars).toHaveLength(3);
    expect(result.timeKnown).toBe(false);
    expect(result.caveats.join("；")).toContain("时辰不详");
  });

  it("keeps four useful-god paths independent and exposes conflicts", () => {
    const result = analyzeUsefulGod({
      pillars: ["甲辰", "丙寅", "庚申", "壬午"],
      dayMasterElement: "metal",
      distribution: { wood: 2, fire: 2, earth: 1, metal: 2, water: 1 },
      monthBranch: "寅",
    });

    expect(result.paths.map((path) => path.pathId)).toEqual([
      "fuyi-v1",
      "yueling-v1",
      "tiaohou-v1",
      "tongguan-v1",
    ]);
    expect(result.paths.every((path) => path.evidence.length > 0)).toBe(true);
    expect(result.paths.every((path) => path.counterEvidence.length > 0)).toBe(true);
    expect(result.consensus.status).toBe("conflict");
  });

  it("keeps name-element scoring unknown until the user confirms a useful element", () => {
    const result = analyzeUsefulGod({
      pillars: ["甲辰", "丙寅", "庚申"],
      dayMasterElement: "metal",
      distribution: { wood: 2, fire: 2, earth: 1, metal: 1, water: 0 },
      monthBranch: "寅",
    });

    expect(result.scoringApplicability).toBe("missing_input");
  });
});
