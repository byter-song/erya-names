import { describe, expect, it } from "vitest";
import scenarios from "../../../fixtures/generation-scenarios.json";
import devBundle from "../../../../src/data/curated/dev-bundle.json";
import { runtimeBundleSchema } from "../../../../src/data/schema/runtimeBundle";
import { generateCandidates } from "../../../../src/domain/generation/generateCandidates";
import { namingProfileSchema } from "../../../../src/domain/project/profile";
import { namingProfileFixture } from "../../../fixtures/namingProfile";

const bundle = runtimeBundleSchema.parse(devBundle);

describe("generation quality fixtures", () => {
  it.each(scenarios)("generates at least 20 traceable candidates for $id", (scenario) => {
    const result = generateCandidates({
      profile: namingProfileSchema.parse({
        ...namingProfileFixture(`project-${scenario.id}`),
        basics: {
          ...namingProfileFixture(`project-${scenario.id}`).basics,
          surname: scenario.surname,
          styleTags: scenario.styleTags,
          pinyinFriendly: true,
        },
      }),
      bundle,
      seed: scenario.id,
      requestedCount: 20,
      allusionRatio: 0.5,
      historicalFingerprints: new Set(),
    });
    expect(result.candidates).toHaveLength(20);
    expect(
      result.candidates.every(
        (candidate) => candidate.sourceIds.length > 0 && candidate.sourceEvidence.length > 0,
      ),
    ).toBe(true);
  });
});
