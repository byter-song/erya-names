import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { scoreAllusionRecord } from "../../../scripts/data/corpusScoring.mjs";
import { sourceManifestSchema } from "../../../scripts/data/sourceManifest";

interface EvidenceRecord {
  sourceId: string;
  title: string;
  work: string;
  location: string;
  quote: string;
  normalizedQuote: string;
  sourceRecordId: string;
  url: string;
  revision: string;
}

describe("A-level curated corpus", () => {
  it("keeps every curated row traceable to a hashed pinned snapshot", async () => {
    const [tsv, evidenceText, charactersText, manifestNames] = await Promise.all([
      readFile("data/sources/personal/a-allusions.tsv", "utf8"),
      readFile("data/sources/personal/a-anthology-evidence.json", "utf8"),
      readFile("data/sources/personal/characters.tsv", "utf8"),
      readdir("data/sources/sources"),
    ]);
    const rows = tsv
      .trim()
      .split("\n")
      .map((line) => line.split("\t"));
    const evidence = JSON.parse(evidenceText) as EvidenceRecord[];
    const characters = new Set(
      charactersText
        .trim()
        .split("\n")
        .map((line) => line.split("\t")[0]),
    );
    const manifests = new Map(
      await Promise.all(
        manifestNames
          .filter((name) => name.startsWith("wikisource-") && name.endsWith(".yaml"))
          .map(async (name) => {
            const manifest = sourceManifestSchema.parse(
              parse(await readFile(path.join("data/sources/sources", name), "utf8")),
            );
            return [manifest.sourceId, manifest] as const;
          }),
      ),
    );

    expect(rows).toHaveLength(23);
    expect(evidence).toHaveLength(rows.length);
    expect(new Set(rows.map(([selectedText]) => selectedText)).size).toBe(rows.length);
    expect(new Set(evidence.map((item) => item.sourceRecordId)).size).toBe(evidence.length);

    for (const [index, row] of rows.entries()) {
      expect(row).toHaveLength(8);
      const [selectedText, title, fragment, , , contextRisk, semanticClarity, nameUsability] =
        row;
      const record = evidence[index];
      expect(record.title).toBe(title);
      expect(record.normalizedQuote).toContain(fragment);
      expect(contextRisk).toMatch(/^(low|medium|high)$/);
      expect(Number(semanticClarity)).toBeGreaterThanOrEqual(1);
      expect(Number(semanticClarity)).toBeLessThanOrEqual(5);
      expect(Number(nameUsability)).toBeGreaterThanOrEqual(1);
      expect(Number(nameUsability)).toBeLessThanOrEqual(5);
      expect(
        scoreAllusionRecord({
          selectedText,
          contextRisk,
          semanticClarity,
          nameUsability,
          ambiguousReadings: 0,
          maximumStrokes: 0,
        }).accepted,
      ).toBe(true);

      let offset = -1;
      for (const char of selectedText) {
        expect(characters.has(char)).toBe(true);
        offset = record.normalizedQuote.indexOf(char, offset + 1);
        expect(offset).toBeGreaterThanOrEqual(0);
      }

      const manifest = manifests.get(record.sourceId);
      expect(manifest?.sourceType).toBe("snapshot");
      if (!manifest || manifest.sourceType !== "snapshot") continue;
      expect(manifest.reviewStatus).toBe("source_checked");
      expect(manifest.personalEligible).toBe(true);
      expect(manifest.releaseEligible).toBe(false);
      const snapshot = manifest.files.find(
        (file) => file.url === record.url && file.revision === record.revision,
      );
      expect(snapshot).toBeDefined();
      if (!snapshot) continue;
      const bytes = await readFile(snapshot.path);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(snapshot.sha256);
      expect(bytes.toString("utf8")).toContain(record.quote);
      expect(new URL(record.url).searchParams.get("oldid")).toBe(record.revision);
    }
  });

  it("covers every specified A-level category with at least two records", async () => {
    const evidence = JSON.parse(
      await readFile("data/sources/personal/a-anthology-evidence.json", "utf8"),
    ) as EvidenceRecord[];
    const categoryCounts = {
      道德经: evidence.filter((item) => item.work === "道德经").length,
      庄子: evidence.filter((item) => item.work === "庄子").length,
      荀子: evidence.filter((item) => item.work === "荀子").length,
      尚书: evidence.filter((item) => item.work === "尚书").length,
      礼记: evidence.filter((item) => item.work === "礼记").length,
      汉代诗歌: evidence.filter((item) => ["古诗十九首", "汉乐府"].includes(item.work)).length,
      陶谢诗: evidence.filter((item) => ["陶渊明诗", "谢灵运诗"].includes(item.work)).length,
    };
    expect(Object.values(categoryCounts).every((count) => count >= 2)).toBe(true);
    expect(evidence.some((item) => item.work === "汉乐府")).toBe(true);
    expect(evidence.some((item) => item.work === "陶渊明诗")).toBe(true);
    expect(evidence.some((item) => item.work === "谢灵运诗")).toBe(true);
    expect(evidence.filter((item) => item.work === "古诗十九首")).toHaveLength(2);
    expect(evidence.filter((item) => item.work === "汉乐府")).toHaveLength(2);
    expect(evidence.filter((item) => item.work === "陶渊明诗")).toHaveLength(2);
    expect(evidence.filter((item) => item.work === "谢灵运诗")).toHaveLength(2);
  });
});
