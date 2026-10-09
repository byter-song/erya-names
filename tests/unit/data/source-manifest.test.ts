import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { sourceManifestSchema } from "../../../scripts/data/sourceManifest";

describe("source manifests", () => {
  it("requires pinned URL, license, commit, checksums, use and review fields", async () => {
    const files = (await readdir("data/sources/sources")).filter((file) =>
      file.endsWith(".yaml"),
    );
    expect(files.length).toBeGreaterThanOrEqual(11);
    for (const file of files) {
      const input: unknown = parse(
        await readFile(path.join("data/sources/sources", file), "utf8"),
      );
      const manifest = sourceManifestSchema.parse(input);
      expect(manifest.sourceId).toBe(file.replace(/\.yaml$/, ""));
      if (manifest.releaseEligible) {
        expect(manifest.reviewStatus).toBe("verified");
        expect(manifest.sourceType).toBe("git");
        if (manifest.sourceType === "git") expect(manifest.commit).toMatch(/^[a-f0-9]{40}$/);
        expect(manifest.license.spdx).not.toBe("UNKNOWN");
        expect(manifest.files.length).toBeGreaterThan(0);
        expect(manifest.files.every((item) => /^[a-f0-9]{64}$/.test(item.sha256))).toBe(true);
      }
      if (manifest.personalEligible) {
        expect(manifest.reviewStatus).toBe("source_checked");
        expect(manifest.releaseEligible).toBe(false);
        expect(manifest.license.spdx).not.toBe("UNKNOWN");
      }
    }
  });

  it("rejects unknown-license and unreviewed sources from release eligibility", () => {
    expect(() =>
      sourceManifestSchema.parse({
        sourceId: "bad",
        repository: "https://example.com",
        commit: "a".repeat(40),
        license: { spdx: "UNKNOWN", file: "LICENSE", sha256: "b".repeat(64) },
        uses: ["characters"],
        reviewStatus: "verified",
        releaseEligible: true,
        files: [{ path: "data.json", sha256: "c".repeat(64) }],
      }),
    ).toThrow();
    expect(() =>
      sourceManifestSchema.parse({
        sourceId: "draft",
        repository: "https://example.com",
        commit: "a".repeat(40),
        license: { spdx: "MIT", file: "LICENSE", sha256: "b".repeat(64) },
        uses: ["characters"],
        reviewStatus: "draft",
        releaseEligible: true,
        files: [{ path: "data.json", sha256: "c".repeat(64) }],
      }),
    ).toThrow();
    expect(() =>
      sourceManifestSchema.parse({
        sourceId: "empty-files",
        repository: "https://example.com",
        commit: "a".repeat(40),
        license: { spdx: "MIT", file: "LICENSE", sha256: "b".repeat(64) },
        uses: ["characters"],
        reviewStatus: "verified",
        releaseEligible: true,
        files: [],
        notes: "invalid",
      }),
    ).toThrow();
  });

  it("requires local snapshots to pin the same oldid as their declared revision", () => {
    const input = {
      sourceId: "snapshot",
      sourceType: "snapshot",
      sourceUrl: "https://zh.wikisource.org/wiki/道德經",
      license: {
        spdx: "CC-BY-SA-4.0",
        file: "data/license.txt",
        sha256: "b".repeat(64),
      },
      uses: ["allusions"],
      reviewStatus: "source_checked",
      releaseEligible: false,
      personalEligible: true,
      files: [
        {
          path: "data/snapshot.txt",
          sha256: "c".repeat(64),
          url: "https://zh.wikisource.org/w/index.php?title=道德經&oldid=123",
          revision: "456",
        },
      ],
      notes: "fixture",
    };
    expect(() => sourceManifestSchema.parse(input)).toThrow(/oldid/);
    expect(() =>
      sourceManifestSchema.parse({
        ...input,
        files: [
          {
            ...input.files[0],
            revision: "123",
          },
        ],
      }),
    ).not.toThrow();
  });

  it("does not allow source_checked personal material into production", () => {
    expect(() =>
      sourceManifestSchema.parse({
        sourceId: "personal-only",
        sourceType: "snapshot",
        sourceUrl: "https://zh.wikisource.org/wiki/道德經",
        license: {
          spdx: "CC-BY-SA-4.0",
          file: "data/license.txt",
          sha256: "b".repeat(64),
        },
        uses: ["allusions"],
        reviewStatus: "source_checked",
        releaseEligible: true,
        personalEligible: true,
        files: [
          {
            path: "data/snapshot.txt",
            sha256: "c".repeat(64),
            url: "https://zh.wikisource.org/w/index.php?title=道德經&oldid=123",
            revision: "123",
          },
        ],
        notes: "fixture",
      }),
    ).toThrow(/production release eligible|Release-eligible/);
  });

  it("supports committed curated snapshots without pretending they are Git sources", () => {
    expect(() =>
      sourceManifestSchema.parse({
        sourceId: "wikidata-person-usage",
        sourceType: "curated",
        sourceUrl: "https://www.wikidata.org/wiki/Wikidata:Licensing",
        license: {
          spdx: "CC0-1.0",
          file: "data/source-meta.json",
          sha256: "b".repeat(64),
        },
        uses: ["persons"],
        reviewStatus: "source_checked",
        releaseEligible: false,
        personalEligible: true,
        files: [{ path: "data/person-snapshot.json", sha256: "c".repeat(64) }],
        notes: "fixture",
      }),
    ).not.toThrow();
  });
});
