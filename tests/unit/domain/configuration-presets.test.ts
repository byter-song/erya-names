import { describe, expect, it } from "vitest";

import {
  applyConfigurationPreset,
  configurationPresets,
} from "../../../src/domain/project/configurationPresets";
import { scoringInputHash } from "../../../src/domain/project/scoringInputHash";
import { namingProfileSchema, type NamingProfile } from "../../../src/domain/project/profile";
import { namingProfileFixture } from "../../fixtures/namingProfile";

const expectedWeights = {
  basic: {
    basic: 100,
    bazi_wuxing: 0,
    zodiac: 0,
    traditional: 0,
    name_hexagram: 0,
    five_grids: 0,
  },
  "traditional-core": {
    basic: 40,
    bazi_wuxing: 35,
    zodiac: 10,
    traditional: 15,
    name_hexagram: 0,
    five_grids: 0,
  },
  "full-professional": {
    basic: 35,
    bazi_wuxing: 25,
    zodiac: 10,
    traditional: 10,
    name_hexagram: 10,
    five_grids: 10,
  },
} as const;

describe("configuration presets", () => {
  it("publishes the three versioned presets with the specified module weights", () => {
    expect(configurationPresets.map(({ id }) => id)).toEqual([
      "basic",
      "traditional-core",
      "full-professional",
    ]);

    for (const preset of configurationPresets) {
      expect(preset.version).toBe("1");
      expect(preset.weights).toEqual(expectedWeights[preset.id]);
    }
  });

  it("enables exactly the positive-weight folklore modules and produces valid profiles", () => {
    const original = namingProfileSchema.parse(namingProfileFixture());

    for (const preset of configurationPresets) {
      const profile = applyConfigurationPreset(original, preset.id);

      expect(profile.scoring).toMatchObject({
        presetId: preset.id,
        presetVersion: preset.version,
        basicWeight: preset.weights.basic,
      });
      expect(namingProfileSchema.safeParse(profile).success).toBe(true);

      for (const [moduleId, module] of Object.entries(profile.modules)) {
        expect(module.analysisEnabled).toBe(preset.weights[moduleId] > 0);
        if (module.analysisEnabled) expect(module.weight).toBeGreaterThan(0);
        else expect(module.weight).toBe(0);
      }
    }
  });

  it("makes folklore the majority of both professional presets", () => {
    for (const preset of configurationPresets.filter(({ id }) => id !== "basic")) {
      const folkloreWeight = Object.entries(preset.weights)
        .filter(([moduleId]) => moduleId !== "basic")
        .reduce((total, [, weight]) => total + weight, 0);
      expect(folkloreWeight).toBeGreaterThan(preset.weights.basic);
      expect(folkloreWeight + preset.weights.basic).toBe(100);
    }
  });
});

describe("scoringInputHash", () => {
  it("ignores every detailsVisible switch", async () => {
    const profile = fullProfessionalProfile();
    const displayOnlyChange = cloneProfile(profile);
    for (const module of Object.values(displayOnlyChange.modules))
      module.detailsVisible = !module.detailsVisible;

    await expect(scoringInputHash(displayOnlyChange)).resolves.toBe(
      await scoringInputHash(profile),
    );
  });

  it.each([
    ["basic configuration", (profile: NamingProfile) => profile.basics.styleTags.push("清朗")],
    [
      "family constraints",
      (profile: NamingProfile) => profile.family.avoidCharacters.push("病"),
    ],
    [
      "calendar convention",
      (profile: NamingProfile) => {
        profile.calendar.dayBoundary = "zi";
      },
    ],
    [
      "useful-god confirmation",
      (profile: NamingProfile) => {
        profile.usefulGodDecision = {
          confirmedElements: ["water"],
          confirmedAt: "2026-10-16T08:00:00.000Z",
        };
      },
    ],
    [
      "analysis enablement",
      (profile: NamingProfile) => {
        profile.modules.zodiac.analysisEnabled = false;
        profile.modules.zodiac.weight = 0;
      },
    ],
    [
      "module weight",
      (profile: NamingProfile) => {
        profile.modules.zodiac.weight = 6;
      },
    ],
    [
      "module school",
      (profile: NamingProfile) => {
        profile.modules.zodiac.schoolId = "zodiac-review-2";
      },
    ],
    [
      "module rule version",
      (profile: NamingProfile) => {
        profile.modules.zodiac.ruleVersion = "zodiac-radical-hints-v2";
      },
    ],
    [
      "basic module weight",
      (profile: NamingProfile) => {
        profile.scoring.basicWeight = 54;
      },
    ],
  ])("changes when %s changes", async (_label, mutate) => {
    const profile = fullProfessionalProfile();
    const changed = cloneProfile(profile);
    mutate(changed);

    expect(await scoringInputHash(changed)).not.toBe(await scoringInputHash(profile));
  });
});

function fullProfessionalProfile(): NamingProfile {
  return namingProfileSchema.parse(
    applyConfigurationPreset(
      namingProfileSchema.parse(namingProfileFixture()),
      "full-professional",
    ),
  );
}

function cloneProfile(profile: NamingProfile): NamingProfile {
  return structuredClone(profile);
}
