import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import Dexie from "dexie";
import { EryaDatabase, ERYA_TABLES } from "../../src/infrastructure/database/EryaDatabase";
import { V1_STORES } from "../../src/infrastructure/database/migrations/v1";
import { V3_STORES } from "../../src/infrastructure/database/migrations/v3";
import { openDatabase } from "../../src/infrastructure/database/openDatabase";

const databases = new Set<string>();

function testDatabaseName(): string {
  const name = `erya-foundation-${crypto.randomUUID()}`;
  databases.add(name);
  return name;
}

afterEach(async () => {
  await Promise.all([...databases].map((name) => EryaDatabase.delete(name)));
  databases.clear();
});

describe("EryaDatabase schema", () => {
  it("creates every v1 table through one upgrade path", async () => {
    const database = await openDatabase({ name: testDatabaseName() });

    expect([...database.tables.map((table) => table.name)].sort()).toEqual(
      [...ERYA_TABLES].sort(),
    );

    database.close();
  });

  it("reopens the same database without losing project or decision tables", async () => {
    const name = testDatabaseName();
    const first = await openDatabase({ name });
    await first.table("projects").put({
      id: "project-1",
      title: "测试方案",
      status: "active",
      updatedAt: "2026-09-17T00:00:00.000Z",
    });
    first.close();

    const reopened = await openDatabase({ name });

    await expect(reopened.table("projects").get("project-1")).resolves.toMatchObject({
      title: "测试方案",
    });
    expect(reopened.table("candidateDecisions").name).toBe("candidateDecisions");
    reopened.close();
  });

  it("migrates valid v1 id-only comparison snapshots to immutable v2 records", async () => {
    const name = testDatabaseName();
    const legacy = new Dexie(name);
    legacy.version(1).stores(V1_STORES);
    await legacy.open();
    await legacy.table("candidates").bulkAdd(
      ["c1", "c2"].map((id) => ({
        id,
        projectId: "p1",
        batchId: null,
        normalizedFingerprint: id,
        surname: "宋",
        givenName: id,
        fullName: id,
        pinyin: [],
        sourceType: "user_input",
        summary: "历史候选",
        sourceIds: [],
        sourceEvidence: [],
        warnings: [],
        riskSignals: [],
        ruleResults: [],
        styleTags: [],
        characterElements: [],
        createdAt: "2026-09-17T00:00:00.000Z",
      })),
    );
    await legacy.table("comparisonSnapshots").add({
      id: "legacy-snapshot",
      projectId: "p1",
      candidateIds: ["c1", "c2"],
      createdAt: "2026-09-17T00:00:00.000Z",
    });
    legacy.close();

    const upgraded = await openDatabase({ name });
    await expect(upgraded.comparisonSnapshots.get("legacy-snapshot")).resolves.toMatchObject({
      name: "历史对比 2026-09-17 00:00",
      candidates: [{ id: "c1" }, { id: "c2" }],
    });
    upgraded.close();
  });

  it("adds an empty character evidence collection to existing v2 candidates", async () => {
    const name = testDatabaseName();
    const legacy = new Dexie(name);
    legacy.version(1).stores(V1_STORES);
    legacy.version(2).stores(V1_STORES);
    await legacy.open();
    await legacy.table("candidates").add({
      id: "legacy-candidate",
      projectId: "p1",
      batchId: null,
      normalizedFingerprint: "宋清扬",
      surname: "宋",
      givenName: "清扬",
      fullName: "宋清扬",
      pinyin: [],
      sourceType: "user_input",
      summary: "",
      sourceIds: [],
      sourceEvidence: [],
      warnings: [],
      riskSignals: [],
      ruleResults: [],
      styleTags: [],
      characterElements: [],
      createdAt: "2026-09-17T00:00:00.000Z",
    });
    legacy.close();
    const upgraded = await openDatabase({ name });
    await expect(upgraded.candidates.get("legacy-candidate")).resolves.toMatchObject({
      characterEvidence: [],
    });
    upgraded.close();
  });

  it("opens legacy v3 decisions behind the v4 compatibility boundary without rewriting them", async () => {
    const name = testDatabaseName();
    const legacy = new Dexie(name);
    legacy.version(3).stores(V3_STORES);
    await legacy.open();
    await legacy.table("candidateDecisions").add({
      candidateId: "c1",
      projectId: "p1",
      stage: "favorite",
      updatedAt: "2026-10-08T00:00:00.000Z",
    });
    legacy.close();

    const upgraded = await openDatabase({ name });
    expect(upgraded.verno).toBe(4);
    await expect(upgraded.candidateDecisions.get("c1")).resolves.toMatchObject({
      stage: "favorite",
    });
    upgraded.close();
  });
});
