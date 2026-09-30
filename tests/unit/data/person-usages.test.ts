import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import personUsages from "../../../data/sources/personal/person-usages.json";
import snapshot from "../../../data/sources/personal/person-usages-wikidata.snapshot.json";
import snapshotMeta from "../../../data/sources/personal/person-usages-wikidata.meta.json";
import { personUsageSchema } from "../../../src/data/schema/runtimeBundle";
import { HISTORICAL_PERSON_QID_WHITELIST } from "../../../scripts/data/normalize/persons";

const root = process.cwd();
const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

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
});
