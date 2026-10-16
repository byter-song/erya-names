import { describe, expect, it } from "vitest";
import {
  listFolkloreRulePacks,
  loadReviewedPreset,
  loadRulePack,
} from "../../../src/data/folklore/loadRulePacks";

const zodiacPack = {
  moduleId: "zodiac" as const,
  schoolId: "zodiac-radical-hints-v1",
  ruleVersion: "1.0.0",
};

describe("folklore rule pack loader", () => {
  it("loads the audited zodiac pack as runnable while preserving its school-specific status", async () => {
    const pack = await loadRulePack(zodiacPack);

    expect(pack.id).toBe("zodiac/zodiac-radical-hints-v1/1.0.0");
    expect(pack.manifest.reviewStatus).toBe("reviewed");
    expect(pack.manifest.epistemicStatus).toBe("school_specific");
    expect(pack.manifest.uncertainty).toMatch(/流派/);
    expect(pack.checksum).toBe(pack.manifest.checksum);
  });

  it("loads reviewed default packs while keeping research-only systems out", async () => {
    await expect(loadReviewedPreset([zodiacPack])).resolves.toHaveLength(1);
    await expect(
      loadRulePack({
        moduleId: "name_hexagram",
        schoolId: "meihua-name-stroke-erya-v1",
        ruleVersion: "1.0.0",
      }),
    ).rejects.toThrow("rule-pack-not-reviewed");
    expect(await listFolkloreRulePacks()).toHaveLength(7);
  });
});
