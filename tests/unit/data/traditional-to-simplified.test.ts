import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import runtimeMapping from "../../../src/data/curated/traditional-to-simplified.json";
import sourceMapping from "../../../data/sources/personal/traditional-to-simplified.json";

describe("traditional-to-simplified mapping", () => {
  it("keeps the expected OpenCC single-character conversions", () => {
    expect(sourceMapping.mappings).toMatchObject({
      臺: "台",
      學: "学",
      詩: "诗",
    });
  });

  it("contains only NFC single-character mappings with stable metadata", () => {
    const entries = Object.entries(sourceMapping.mappings);

    expect(entries).toHaveLength(4148);
    expect(
      entries.every(
        ([traditional, simplified]) =>
          [...traditional].length === 1 &&
          [...simplified].length === 1 &&
          traditional === traditional.normalize("NFC") &&
          simplified === simplified.normalize("NFC"),
      ),
    ).toBe(true);
    expect(sourceMapping.manifest.counts.mappings).toBe(entries.length);
    expect(sourceMapping.manifest).toMatchObject({
      version: "traditional-to-simplified-2026.09.30",
      checkedAt: "2026-09-30",
    });
    expect(sourceMapping.manifest.inputSha256).toBe(
      sourceMapping.manifest.sourceRefs[0]?.sha256,
    );
    expect(sourceMapping.manifest.contentSha256).toBe(hash(sourceMapping.mappings));
    expect(sourceMapping.manifest.sourceRefs[0]).toMatchObject({
      sourceId: "opencc",
      version: "5c764a5a886f46eb365656ed91a0410d7162fac6",
      location: "data/dictionary/TSCharacters.txt",
      sha256: "9ff46a7d30e5765375eb13d33f2b03a34d298913caf2b120380679f33ae1642d",
    });
  });

  it("keeps the runtime derivative identical to the committed SSOT", () => {
    expect(runtimeMapping.schemaVersion).toBe(sourceMapping.schemaVersion);
    expect(runtimeMapping.manifest).toEqual(sourceMapping.manifest);
    expect(runtimeMapping.mappings).toEqual(sourceMapping.mappings);
  });
});

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
