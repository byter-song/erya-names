import { describe, it, expect } from "vitest";
import personal from "../../../src/data/curated/personal-bundle.json";
import { runtimeBundleSchema } from "../../../src/data/schema/runtimeBundle";
import { namingProfileSchema } from "../../../src/domain/project/profile";
import { generateCandidates } from "../../../src/domain/generation/generateCandidates";
import {
  calculateBasicFiveElements,
  validateBirthDateTime,
} from "../../../src/domain/folklore/calendarAdapter";
import { calculateFiveGrids } from "../../../src/domain/folklore/fiveGrids";
import { readSurname, normalizePinyin } from "../../../src/domain/candidate/nameReading";
import { namingProfileFixture } from "../../fixtures/namingProfile";
const bundle = runtimeBundleSchema.parse(personal);
const profile = namingProfileSchema.parse({
  ...namingProfileFixture("studio-test"),
  basics: {
    ...namingProfileFixture("studio-test").basics,
    styleTags: ["清朗自然"],
    pinyinFriendly: true,
  },
});
const generate = (patch: Partial<typeof profile> = {}, history = new Set<string>()) =>
  generateCandidates({
    profile: { ...profile, ...patch },
    bundle,
    seed: "studio-test",
    requestedCount: 96,
    allusionRatio: 0.5,
    historicalFingerprints: history,
  });
describe("personal corpus and naming invariants", () => {
  it("has 300+ independently documented characters and traceable quotations", () => {
    expect(bundle.characters.length).toBeGreaterThanOrEqual(300);
    expect(bundle.allusions.length).toBeGreaterThanOrEqual(350);
    expect(bundle.allusions.length).toBeLessThanOrEqual(450);
    expect(bundle.personUsages.length).toBeGreaterThanOrEqual(60);
    expect(Object.keys(bundle.standardCharacterPinyin)).toHaveLength(8105);
    expect(Object.keys(bundle.traditionalToSimplified)).toHaveLength(4148);
    for (const entry of bundle.characters) {
      expect(entry.meanings[0]!.length).toBeGreaterThan(5);
      expect(entry.strokes).toBeGreaterThan(0);
      expect(entry.reviewStatus).toBe("source_checked");
      expect(entry.element).toMatch(/^(wood|fire|earth|metal|water)$/);
      expect(entry.elementReason).toContain(`“${entry.char}”`);
      expect(entry.elementEvidence).toMatchObject({
        methodVersion: "semantic-imagery-1",
        reviewStatus: "source_checked",
      });
    }
    for (const entry of bundle.allusions) {
      expect([...entry.selectedText]).toHaveLength(2);
      expect(entry.corpusScore).toMatchObject({
        accepted: true,
        threshold: 70,
        modelVersion: "corpus-score-1",
      });
      expect(entry.corpusScore?.total).toBeGreaterThanOrEqual(70);
      let index = -1;
      for (const char of entry.selectedText) {
        index = entry.quote.indexOf(char, index + 1);
        expect(index, entry.selectedText).toBeGreaterThanOrEqual(0);
      }
    }
  });
  it("generates successive diverse batches without repeating names and retains exact source type", () => {
    const first = generate();
    const second = generate({}, new Set(first.candidates.map((x) => x.normalizedFingerprint)));
    expect(first.candidates).toHaveLength(96);
    expect(second.candidates).toHaveLength(96);
    expect(
      new Set([...first.candidates, ...second.candidates].map((x) => x.fullName)).size,
    ).toBe(192);
    expect(
      first.candidates.filter((x) => x.sourceType === "verified_allusion").length,
    ).toBeGreaterThan(20);
    expect(
      first.candidates
        .filter((x) => x.sourceType === "verified_allusion")
        .every((x) =>
          x.ruleResults.some(
            (rule) => rule.ruleId === "l3-corpus-quality" && (rule.scoreDelta ?? 0) <= 0,
          ),
        ),
    ).toBe(true);
    expect(
      first.candidates.every((x) => x.ruleResults.every((r) => r.outcome !== "reject")),
    ).toBe(true);
    expect(first.candidates.every((x) => x.characterElements.length === 2)).toBe(true);
  });
  it("enforces fixed position, avoid characters and family exclusions", () => {
    const result = generate({
      family: {
        ...profile.family,
        requiredCharacters: [{ char: "知", position: 1 }],
        avoidCharacters: ["远"],
        forbiddenCombinations: ["知安"],
        relativeNames: ["宋知宁"],
      },
    });
    expect(result.candidates.length).toBeGreaterThan(0);
    for (const candidate of result.candidates) {
      expect(candidate.givenName[0]).toBe("知");
      expect(candidate.givenName).not.toContain("远");
      expect(candidate.fullName).not.toBe("宋知宁");
      expect(candidate.givenName).not.toBe("知安");
    }
  });
  it("keeps folklore out of generation and never lets it override a family constraint", () => {
    const result = generate({
      family: { ...profile.family, avoidCharacters: ["清"] },
      modules: {
        ...profile.modules,
        bazi_wuxing: {
          ...profile.modules.bazi_wuxing,
          analysisEnabled: true,
          weight: 20,
        },
      },
    });
    expect(result.candidates.every((x) => !x.givenName.includes("清"))).toBe(true);
    expect(
      result.candidates.every((x) => x.ruleResults.every((r) => r.evidenceLevel !== "L4")),
    ).toBe(true);
    const off = generate({
      family: { ...profile.family, avoidCharacters: ["清"] },
      modules: {
        ...profile.modules,
        bazi_wuxing: {
          ...profile.modules.bazi_wuxing,
          analysisEnabled: false,
          weight: 0,
        },
      },
    });
    expect(
      off.candidates.every((x) => x.ruleResults.every((r) => r.evidenceLevel !== "L4")),
    ).toBe(true);
    expect(result.candidates.map((item) => item.fullName)).toEqual(
      off.candidates.map((item) => item.fullName),
    );
  });
  it("keeps historical and imperial-exam usage outside generation scores and ordering", () => {
    const input = {
      profile,
      seed: "person-usage-neutrality",
      requestedCount: 48,
      allusionRatio: 0.5,
      historicalFingerprints: new Set<string>(),
    };
    const withUsages = generateCandidates({ ...input, bundle });
    const withoutUsages = generateCandidates({
      ...input,
      bundle: { ...bundle, personUsages: [] },
    });

    expect(withUsages.candidates).toEqual(withoutUsages.candidates);
  });
  it("rejects invalid batch inputs and impossible family profiles", () => {
    expect(() =>
      generateCandidates({
        profile,
        bundle,
        seed: "invalid",
        requestedCount: 0,
        allusionRatio: 0.5,
        historicalFingerprints: new Set(),
      }),
    ).toThrow();
    expect(() =>
      namingProfileSchema.parse({
        ...profile,
        family: {
          ...profile.family,
          requiredCharacters: [
            { char: "清", position: 1 },
            { char: "宁", position: 1 },
          ],
        },
      }),
    ).toThrow();
  });
  it("keeps polyphonic surnames explicit and permits a family correction", () => {
    expect(readSurname("单")).toEqual(["shàn"]);
    expect(readSurname("曾", "céng")).toEqual(["céng"]);
    expect(readSurname("欧阳")).toEqual(["ōu", "yáng"]);
  });
});
it("removes tone marks without conflating u and ü", () => {
  expect(normalizePinyin(["lǜ"])).toBe("lü");
  expect(normalizePinyin(["lù"])).toBe("lu");
  expect(normalizePinyin(["lǜ"])).not.toBe(normalizePinyin(["lù"]));
});
describe("calendar boundaries and transparent folklore calculations", () => {
  it.each([
    "2024-02-30T12:00",
    "2023-02-29T00:00",
    "2024-13-01T00:00",
    "2024-01-01T24:00",
    "1800-01-01T00:00",
  ])("rejects an impossible date %s", (value) =>
    expect(validateBirthDateTime(value)).toBeTruthy(),
  );
  it("supports leap days and omits the time pillar when the time is unknown", () => {
    expect(validateBirthDateTime("2024-02-29T00:00")).toBeUndefined();
    const report = calculateBasicFiveElements({
      localDateTime: "2024-02-10",
      timeZone: "Asia/Shanghai",
      timeKnown: false,
    });
    expect(report.pillars).toHaveLength(3);
    expect(Object.values(report.distribution).reduce((a, b) => a + b, 0)).toBe(6);
    expect(report.columns.some((x) => x.label === "时柱")).toBe(false);
  });
  it("distinguishes the lunar new year from the Li Chun year pillar", () => {
    const before = calculateBasicFiveElements({
      localDateTime: "2024-02-04T16:00",
      timeZone: "Asia/Shanghai",
    });
    const after = calculateBasicFiveElements({
      localDateTime: "2024-02-04T17:00",
      timeZone: "Asia/Shanghai",
    });
    expect(before.pillars[0]).toBe("癸卯");
    expect(after.pillars[0]).toBe("甲辰");
    expect(after.lunarZodiac).toBe("兔");
    expect(after.pillarZodiac).toBe("龙");
  });
  it("makes the late Zi hour convention visible", () => {
    const input = { localDateTime: "2024-02-10T23:30", timeZone: "Asia/Shanghai" };
    expect(
      calculateBasicFiveElements({ ...input, dayBoundary: "midnight" }).pillars[2],
    ).not.toBe(calculateBasicFiveElements({ ...input, dayBoundary: "zi" }).pillars[2]);
  });
  it("calculates single and compound surnames using explicit virtual strokes", () => {
    expect(calculateFiveGrids([4], [11, 6]).map((x) => x.value)).toEqual([5, 15, 17, 7, 21]);
    expect(calculateFiveGrids([8, 6], [6]).map((x) => x.value)).toEqual([14, 12, 7, 9, 20]);
    expect(() => calculateFiveGrids([0], [6])).toThrow();
  });
});

it("keeps editorial interpretation when the same characters could also be freely combined", () => {
  const combination = bundle.modernCombinations?.[0];
  expect(combination).toBeDefined();
  for (const seed of ["a", "b", "c", "d", "e"]) {
    const result = generateCandidates({
      profile: {
        ...profile,
        family: {
          ...profile.family,
          requiredCharacters: [
            { char: combination!.givenName[0]!, position: 1 },
            { char: combination!.givenName[1]!, position: 2 },
          ],
        },
      },
      bundle,
      seed,
      requestedCount: 1,
      allusionRatio: 0,
      historicalFingerprints: new Set(),
    });
    expect(result.candidates[0]?.summary).toBe(combination!.meaning);
    expect(
      result.candidates[0]?.sourceEvidence.some(
        (source) => source.excerpt === combination!.usageNote,
      ),
    ).toBe(true);
  }
});
