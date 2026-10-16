import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import {
  ERYA_DATABASE_NAME,
  ERYA_DATABASE_VERSION,
  ERYA_TABLES,
  EryaDatabase,
} from "../../src/infrastructure/database/EryaDatabase";
import { openDatabase } from "../../src/infrastructure/database/openDatabase";

const LEGACY_DATABASE_NAME = "erya-names";
const V2_DATABASE_NAME = "erya-names-v2";
const TARGET_TABLES = [
  "projects",
  "profiles",
  "generationBatches",
  "candidates",
  "candidateSources",
  "candidateDecisions",
  "decisionHistory",
  "candidateEvaluations",
  "projectAssessments",
  "ruleEvidence",
  "candidateScores",
  "assessmentRuns",
  "appMetadata",
] as const;

afterEach(async () => {
  await Promise.all([Dexie.delete(LEGACY_DATABASE_NAME), Dexie.delete(V2_DATABASE_NAME)]);
});

function expectCompoundIndex(
  database: EryaDatabase,
  tableName: string,
  indexName: string,
  options: { unique: boolean },
): void {
  const index = database.table(tableName).schema.indexes.find(({ name }) => name === indexName);

  expect(index, `${tableName}.${indexName}`).toMatchObject({
    name: indexName,
    compound: true,
    unique: options.unique,
  });
}

describe("EryaDatabase v2 schema", () => {
  it("opens erya-names-v2 at schema version 1 with the 13 target tables", async () => {
    const database = await openDatabase();

    try {
      expect(ERYA_DATABASE_NAME).toBe(V2_DATABASE_NAME);
      expect(ERYA_DATABASE_VERSION).toBe(1);
      expect(database.name).toBe(V2_DATABASE_NAME);
      expect(database.verno).toBe(1);
      expect([...ERYA_TABLES].sort()).toEqual([...TARGET_TABLES].sort());
      expect(database.tables.map(({ name }) => name).sort()).toEqual([...TARGET_TABLES].sort());
    } finally {
      database.close();
    }
  });

  it("declares the candidate, pool, assessment, and evidence compound indexes", async () => {
    const database = await openDatabase();

    try {
      expectCompoundIndex(database, "candidates", "[projectId+normalizedFingerprint]", {
        unique: true,
      });
      expectCompoundIndex(database, "candidateDecisions", "[projectId+pool]", {
        unique: false,
      });
      expectCompoundIndex(database, "projectAssessments", "[projectId+moduleId]", {
        unique: true,
      });
      expectCompoundIndex(database, "ruleEvidence", "[projectId+candidateId]", {
        unique: false,
      });
      expectCompoundIndex(database, "ruleEvidence", "[candidateId+moduleId]", {
        unique: false,
      });
    } finally {
      database.close();
    }
  });

  it("does not read from or upgrade an existing erya-names database", async () => {
    const legacy = new Dexie(LEGACY_DATABASE_NAME);
    legacy.version(1).stores({
      projects: "&id",
      legacyRecords: "&id",
    });
    await legacy.open();
    await legacy.table("projects").add({ id: "legacy-project", title: "旧方案" });
    await legacy.table("legacyRecords").add({ id: "legacy-marker", value: "keep-me" });
    legacy.close();

    const current = await openDatabase();
    try {
      expect(current.name).toBe(V2_DATABASE_NAME);
      await expect(current.table("projects").count()).resolves.toBe(0);
    } finally {
      current.close();
    }

    const untouchedLegacy = new Dexie(LEGACY_DATABASE_NAME);
    await untouchedLegacy.open();
    try {
      expect(untouchedLegacy.verno).toBe(1);
      expect(untouchedLegacy.tables.map(({ name }) => name).sort()).toEqual([
        "legacyRecords",
        "projects",
      ]);
      await expect(
        untouchedLegacy.table("legacyRecords").get("legacy-marker"),
      ).resolves.toEqual({
        id: "legacy-marker",
        value: "keep-me",
      });
      await expect(
        untouchedLegacy.table("projects").get("legacy-project"),
      ).resolves.toMatchObject({
        title: "旧方案",
      });
    } finally {
      untouchedLegacy.close();
    }
  });
});
