import { expect, it } from "vitest";
import {
  evaluateFamilyConstraints,
  familySyllable,
} from "../../src/domain/rules/l1/familyConstraint";
import { namingProfileSchema } from "../../src/domain/project/profile";
import { namingProfileFixture } from "../fixtures/namingProfile";
import { generateCandidates } from "../../src/domain/generation/generateCandidates";
import { runtimeBundleSchema } from "../../src/data/schema/runtimeBundle";
import personal from "../../src/data/curated/personal-bundle.json";

it("checks each relative against the given name without treating a shared surname as a taboo", () => {
  const profile = {
    ...namingProfileFixture(),
    surname: "林",
    relativeAvoidances: [
      { fullName: "林清和", givenName: "清和", mode: "same-character" as const, pinyin: [] },
    ],
  };
  const check = (givenName: string) =>
    evaluateFamilyConstraints({ profile, fullName: `林${givenName}`, givenName });
  expect(check("松柏").outcome).toBe("pass");
  expect(check("清扬").explanation).toContain("名同字：清");
});

it("compares explicit Mandarin syllables across tones while keeping u distinct from ü", () => {
  const profile = {
    ...namingProfileFixture(),
    relativeAvoidances: [
      {
        fullName: "林庆和",
        givenName: "庆和",
        mode: "same-sound" as const,
        pinyin: ["qìng", "hé"],
      },
    ],
  };
  const check = (pinyin?: string[]) =>
    evaluateFamilyConstraints({
      profile,
      fullName: "宋清扬",
      givenName: "清扬",
      ...(pinyin ? { pinyin } : {}),
    });
  expect(check(["qīng", "yáng"]).explanation).toContain("不分声调");
  expect(check().explanation).toContain("缺少完整读音");
  expect(familySyllable("lǜ")).toBe(familySyllable("lv4"));
  expect(familySyllable("lǜ")).not.toBe(familySyllable("lù"));
});

it("validates relative boundaries and applies same-sound constraints during generation", () => {
  const profile = {
    ...namingProfileFixture(),
    constraintKnowledge: "present" as const,
    relativeAvoidances: [
      {
        fullName: "林庆和",
        givenName: "庆和",
        mode: "same-sound" as const,
        pinyin: ["qing", "he"],
      },
    ],
  };
  expect(namingProfileSchema.safeParse(profile).success).toBe(true);
  expect(
    namingProfileSchema.safeParse({
      ...profile,
      relativeAvoidances: [{ ...profile.relativeAvoidances[0], givenName: "知远" }],
    }).success,
  ).toBe(false);
  const result = generateCandidates({
    profile,
    bundle: runtimeBundleSchema.parse(personal),
    seed: "relative",
    requestedCount: 9,
    allusionRatio: 0.5,
    historicalFingerprints: new Set<string>(),
  });
  expect(result.candidates.length).toBeGreaterThan(0);
  expect(
    result.candidates.every((c) =>
      c.pinyin.every((p) => !["qing", "he"].includes(familySyllable(p))),
    ),
  ).toBe(true);
});
