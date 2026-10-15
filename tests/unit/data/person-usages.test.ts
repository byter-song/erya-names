import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";
import personUsages from "../../../data/sources/personal/person-usages.json";
import snapshot from "../../../data/sources/personal/person-usages-wikidata.snapshot.json";
import snapshotMeta from "../../../data/sources/personal/person-usages-wikidata.meta.json";
import { personUsageSchema } from "../../../src/data/schema/runtimeBundle";
import { HISTORICAL_PERSON_QID_WHITELIST } from "../../../scripts/data/normalize/persons";

const root = process.cwd();
const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const imperialManifest = parseYaml(
  readFileSync(`${root}/data/sources/sources/wikipedia-imperial-exam.yaml`, "utf8"),
) as {
  sourceId: string;
  sourceType: string;
  license: { spdx: string; file: string; sha256: string };
  files: Array<{ path: string; sha256: string; url: string; revision: string }>;
};
const manualManifest = parseYaml(
  readFileSync(`${root}/data/sources/sources/manual-imperial-exam-curation.yaml`, "utf8"),
) as { files: Array<{ path: string; sha256: string }> };

describe("person usage source data", () => {
  it("pins the query and CC0 snapshot to the fixed QID allowlist", () => {
    const queryPath = `${root}/${snapshotMeta.queryPath}`;
    const snapshotPath = `${root}/${snapshotMeta.snapshotPath}`;
    const query = readFileSync(queryPath, "utf8");

    expect(snapshotMeta.license).toBe("CC0-1.0");
    expect(snapshotMeta.qidWhitelist).toEqual(HISTORICAL_PERSON_QID_WHITELIST);
    expect(snapshot.rows.map((row) => row.qid).sort()).toEqual(
      [...HISTORICAL_PERSON_QID_WHITELIST].sort(),
    );
    expect(HISTORICAL_PERSON_QID_WHITELIST.every((qid) => query.includes(`wd:${qid}`))).toBe(
      true,
    );
    expect(sha256(queryPath)).toBe(snapshotMeta.querySha256);
    expect(sha256(snapshotPath)).toBe(snapshotMeta.snapshotSha256);
  });

  it("keeps historical and imperial-exam records valid and semantically separate", () => {
    const parsed = personUsages.map((usage) => personUsageSchema.parse(usage));
    const identityTypes = new Set(parsed.map((usage) => usage.identityType));
    const historicalQids = parsed
      .filter((usage) => usage.identityType === "historical_person")
      .map((usage) => usage.id.replace("person:", ""));

    expect(historicalQids.sort()).toEqual([...HISTORICAL_PERSON_QID_WHITELIST].sort());
    expect(identityTypes).toEqual(
      new Set(["historical_person", "zhuangyuan", "bangyan", "tanhua", "jinshi"]),
    );
    expect(
      parsed
        .filter((usage) => usage.identityType !== "historical_person")
        .every((usage) => usage.rankEvidence.length > 0),
    ).toBe(true);
  });

  it("provides at least ten independently ranked records in every exam category", () => {
    const parsed = personUsages.map((usage) => personUsageSchema.parse(usage));
    const ids = parsed.map((usage) => usage.id);
    const counts = new Map<string, number>();
    for (const usage of parsed) {
      counts.set(usage.identityType, (counts.get(usage.identityType) ?? 0) + 1);
      expect(usage.name).toMatch(/^\p{Script=Han}{2,4}$/u);
      expect(usage.sourceRefs.every((source) => source.url)).toBe(true);
    }

    expect(parsed.length).toBeGreaterThanOrEqual(60);
    expect(new Set(ids).size).toBe(ids.length);
    for (const identityType of ["zhuangyuan", "bangyan", "tanhua", "jinshi"]) {
      expect(counts.get(identityType)).toBeGreaterThanOrEqual(10);
    }
    expect(parsed).toHaveLength(81);
    expect(counts.get("zhuangyuan")).toBe(30);
  });

  it("adds reviewed cross-dynasty zhuangyuan inspiration characters", () => {
    const added = personUsages.filter(
      (usage) => usage.identityType === "zhuangyuan" && usage.checkedAt === "2026-10-15",
    );
    const periods = added.map((usage) => usage.period);

    expect(added).toHaveLength(15);
    expect(added.filter((usage) => usage.inspirationEligible)).toHaveLength(14);
    expect(periods.some((period) => period.startsWith("唐·"))).toBe(true);
    expect(periods.some((period) => period.startsWith("北宋·"))).toBe(true);
    expect(periods.some((period) => period.startsWith("元·"))).toBe(true);
    expect(periods.some((period) => period.startsWith("明·"))).toBe(true);
    expect(periods.some((period) => period.startsWith("清·"))).toBe(true);
    for (const usage of added) {
      expect(usage.sourceRefs.every((source) => source.url.startsWith("https://"))).toBe(true);
      if (!usage.inspirationEligible) continue;
      expect(usage.inspirationCharacters?.length).toBeGreaterThan(0);
      expect(usage.inspirationCharacters?.every((char) => usage.name.includes(char))).toBe(
        true,
      );
      expect(usage.inspirationReviewNote).toBeTruthy();
    }
  });

  it("contains only deceased historical people and historical exam cohorts", () => {
    expect(
      snapshot.rows.every(
        (row) => row.deathDate && new Date(row.deathDate).getTime() < Date.now(),
      ),
    ).toBe(true);

    const imperialPeriods = personUsages
      .filter((usage) => usage.identityType !== "historical_person")
      .map((usage) => usage.period);
    expect(
      imperialPeriods.every((period) => {
        const year = period.match(/（(\d{3,4})）$/u)?.[1];
        return year ? Number(year) <= 1904 : period.endsWith("朝");
      }),
    ).toBe(true);
  });

  it("keeps every new Qing exam record tied to an exact year, rank and pinned revision", () => {
    const parsed = personUsages.map((usage) => personUsageSchema.parse(usage));
    const pinnedUrls = new Set(imperialManifest.files.map((file) => file.url));
    const expectedRank = {
      zhuangyuan: "一甲第一名",
      bangyan: "一甲第二名",
      tanhua: "一甲第三名",
      jinshi: "二甲第一名，赐进士出身",
    } as const;
    const pinnedRecords = parsed.filter((usage) =>
      usage.sourceRefs.some((source) => source.sourceId === imperialManifest.sourceId),
    );

    expect(pinnedRecords).toHaveLength(60);
    for (const usage of pinnedRecords) {
      expect(usage.identityType).not.toBe("historical_person");
      if (usage.identityType === "historical_person") continue;
      expect(usage.period).toMatch(/（(?:18|19)\d{2}）$/u);
      expect(usage.rankEvidence).toContain("科殿试");
      expect(usage.rankEvidence).toContain(expectedRank[usage.identityType]);
      for (const source of usage.sourceRefs) {
        expect(source.sourceId).toBe("wikipedia-imperial-exam");
        expect(source.url).toMatch(/[?&]oldid=\d+$/u);
        expect(pinnedUrls.has(source.url ?? "")).toBe(true);
      }
    }
    expect(
      pinnedRecords
        .filter((usage) => usage.identityType === "jinshi")
        .every((usage) => !usage.rankEvidence.includes("一甲第一名")),
    ).toBe(true);
  });

  it("pins the Wikipedia license and every local exam excerpt by hash and oldid", () => {
    expect(imperialManifest.sourceType).toBe("snapshot");
    expect(imperialManifest.license.spdx).toBe("CC-BY-SA-4.0");
    expect(sha256(`${root}/${imperialManifest.license.file}`)).toBe(
      imperialManifest.license.sha256,
    );
    expect(imperialManifest.files).toHaveLength(15);
    for (const file of imperialManifest.files) {
      expect(sha256(`${root}/${file.path}`)).toBe(file.sha256);
      expect(new URL(file.url).searchParams.get("oldid")).toBe(file.revision);
    }
  });

  it("pins the final person-usage dataset hash in its curation contract", () => {
    const personUsageFile = manualManifest.files.find((file) =>
      file.path.endsWith("person-usages.json"),
    );
    expect(personUsageFile).toBeDefined();
    expect(sha256(`${root}/${personUsageFile?.path}`)).toBe(personUsageFile?.sha256);
  });
});
