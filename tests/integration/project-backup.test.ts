import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { BACKUP_FORMAT } from "../../src/application/backup/backupSchema";
import { ExportProjectBackup } from "../../src/application/use-cases/ExportProjectBackup";
import { ImportProjectBackup } from "../../src/application/use-cases/ImportProjectBackup";
import { PreviewBackupImport } from "../../src/application/use-cases/PreviewBackupImport";
import { EryaDatabase } from "../../src/infrastructure/database/EryaDatabase";
import { DexieBackupRepository } from "../../src/infrastructure/repositories/DexieBackupRepository";
import { namingProfileFixture } from "../fixtures/namingProfile";
import { namingProjectFixture } from "../fixtures/namingProject";

const databaseNames = new Set<string>();

afterEach(async () => {
  await Promise.all([...databaseNames].map((name) => EryaDatabase.delete(name)));
  databaseNames.clear();
});

function createDatabase(): EryaDatabase {
  const name = `erya-v2-backup-${crypto.randomUUID()}`;
  databaseNames.add(name);
  return new EryaDatabase(name);
}

async function seedProject(database: EryaDatabase, projectId = "project-song") {
  const profile = namingProfileFixture(projectId);
  const selectedId =
    projectId === "project-song" ? "candidate-selected" : `${projectId}:selected`;
  const excludedId =
    projectId === "project-song" ? "candidate-excluded" : `${projectId}:excluded`;
  await database.projects.add(namingProjectFixture(projectId));
  await database.profiles.add(profile);
  await database.generationBatches.add({
    id: `${projectId}:batch-1`,
    projectId,
    sequence: 1,
    seed: "backup-seed",
    inspirationSources: ["poetry", "historical"],
    requestedCount: 2,
    profileSnapshot: profile,
    datasetVersion: "personal-2026.10.16",
    rulePackVersion: "folklore-rules-1",
    status: "completed",
    statistics: {
      sourceCandidates: 2,
      hardRejected: 0,
      duplicateRejected: 0,
      historicalRejected: 0,
      persisted: 2,
    },
    createdAt: "2026-10-16T01:00:00.000Z",
  });
  await database.candidates.bulkAdd([
    candidate(projectId, selectedId, "宋清扬", "清扬"),
    candidate(projectId, excludedId, "宋知远", "知远"),
  ]);
  await database.candidateSources.bulkAdd([
    {
      id: `${projectId}:source-1`,
      projectId,
      candidateId: selectedId,
      sourceId: "shijing",
      work: "诗经",
      quote: "有美一人，清扬婉兮",
    },
    {
      id: `${projectId}:source-2`,
      projectId,
      candidateId: excludedId,
      sourceId: "zhuangyuan",
      work: "历代状元",
    },
  ]);
  await database.candidateDecisions.bulkAdd([
    {
      projectId,
      candidateId: selectedId,
      pool: "selected",
      updatedAt: "2026-10-16T02:00:00.000Z",
    },
    {
      projectId,
      candidateId: excludedId,
      pool: "excluded",
      lastActivePool: "candidate",
      exclusionReason: "家人读音偏好",
      excludedAt: "2026-10-16T02:10:00.000Z",
      updatedAt: "2026-10-16T02:10:00.000Z",
    },
  ]);
  await database.decisionHistory.add({
    projectId,
    candidateId: excludedId,
    from: "candidate",
    to: "excluded",
    action: "exclude",
    exclusionReason: "家人读音偏好",
    changedAt: "2026-10-16T02:10:00.000Z",
  });
  await database.candidateEvaluations.add({
    projectId,
    candidateId: selectedId,
    rating: 5,
    note: "含义与读音都喜欢",
    updatedAt: "2026-10-16T02:20:00.000Z",
  });
  await database.projectAssessments.add({
    id: `${projectId}:zodiac`,
    projectId,
    moduleId: "zodiac",
    configRevision: 0,
    inputHash: "profile-hash",
    result: { zodiac: "dragon", applicability: "source_unverified" },
  });
  await database.ruleEvidence.add({
    id: `${projectId}:evidence-1`,
    projectId,
    candidateId: selectedId,
    moduleId: "basic",
    dimensionId: "meaning",
    ruleId: "basic-meaning",
    ruleVersion: "1",
    severity: "soft",
    status: "pass",
    applicability: "applied",
    scoreBefore: 100,
    deduction: 0,
    scoreAfter: 100,
    explanation: "字义清朗",
    inputSummary: "宋清扬",
    inputHash: "candidate-hash",
    calculation: ["100 - 0 = 100"],
    sourceIds: ["shijing"],
  });
  await database.candidateScores.add({
    candidateId: selectedId,
    projectId,
    configRevision: 0,
    inputHash: "candidate-hash",
    hardStatus: "pass",
    totalScore: 100,
    completeness: 1,
    evaluatedDimensions: 1,
    expectedDimensions: 1,
    hiddenScoredModuleCount: 0,
    moduleScores: { basic: 100 },
    topDeductions: [],
  });
  await database.assessmentRuns.add({
    projectId,
    runId: `${projectId}:run-1`,
    configRevision: 0,
    status: "completed",
    completed: 2,
    total: 2,
  });
  await database.appMetadata.add({
    key: `project:${projectId}:report-layout`,
    value: "compact",
  });
}

function candidate(projectId: string, id: string, fullName: string, givenName: string) {
  return {
    id,
    projectId,
    batchId: `${projectId}:batch-1`,
    normalizedFingerprint: fullName,
    surname: "宋",
    givenName,
    fullName,
    pinyin: ["sòng"],
    sourceType: "verified_allusion" as const,
    summary: "来源已核对",
    createdAt: "2026-10-16T01:00:00.000Z",
  };
}

function exporter(database: EryaDatabase) {
  return new ExportProjectBackup(new DexieBackupRepository(database), {
    appVersion: "1.0.0",
    datasetVersion: "personal-2026.10.16",
    rulePackVersion: "folklore-rules-1",
    now: () => "2026-10-16T10:00:00.000Z",
  });
}

describe("v2 project backup round trip", () => {
  it("exports every project-owned v2 table without leaking another project", async () => {
    const source = createDatabase();
    await seedProject(source);
    await seedProject(source, "project-li");

    const result = await exporter(source).execute("project-song");
    if (!result.ok) throw new Error(result.error);

    expect(result.value).toMatchObject({ format: BACKUP_FORMAT, schemaVersion: 1 });
    expect(result.value.payload).toMatchObject({
      projectId: "project-song",
      candidates: expect.arrayContaining([
        expect.objectContaining({ id: "candidate-selected" }),
        expect.objectContaining({ id: "candidate-excluded" }),
      ]),
      candidateDecisions: expect.arrayContaining([
        expect.objectContaining({ candidateId: "candidate-selected", pool: "selected" }),
        expect.objectContaining({ candidateId: "candidate-excluded", pool: "excluded" }),
      ]),
      ruleEvidence: [expect.objectContaining({ id: "project-song:evidence-1" })],
      candidateScores: [expect.objectContaining({ candidateId: "candidate-selected" })],
    });
    expect(JSON.stringify(result.value.payload)).not.toContain("project-li");
    source.close();
  });

  it("previews without writing and restores a conflict under a fresh project id", async () => {
    const source = createDatabase();
    await seedProject(source);
    const exported = await exporter(source).execute("project-song");
    if (!exported.ok) throw new Error(exported.error);

    const target = createDatabase();
    await target.projects.add(namingProjectFixture());
    const repository = new DexieBackupRepository(target);
    const preview = await new PreviewBackupImport(repository).execute(exported.value);
    expect(preview).toMatchObject({
      ok: true,
      value: {
        conflict: "project-id",
        counts: { candidates: 2, ruleEvidence: 1, candidateScores: 1 },
        poolCounts: { selected: 1, excluded: 1 },
      },
    });
    expect(await target.candidates.count()).toBe(0);

    const imported = await new ImportProjectBackup(repository, {
      createProjectId: () => "project-restored",
    }).execute({ envelope: exported.value, conflictStrategy: "import-copy" });
    expect(imported).toEqual({
      ok: true,
      value: { projectId: "project-restored", action: "imported" },
    });
    expect(await target.projects.get("project-song")).toMatchObject({ id: "project-song" });
    expect(await target.projects.get("project-restored")).toMatchObject({
      id: "project-restored",
      title: "宋姓宝宝起名（副本）",
    });
    expect(
      await target.candidateDecisions.where("projectId").equals("project-restored").toArray(),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pool: "selected" }),
        expect.objectContaining({
          pool: "excluded",
          lastActivePool: "candidate",
          exclusionReason: "家人读音偏好",
        }),
      ]),
    );
    expect(
      await target.ruleEvidence.where("projectId").equals("project-restored").count(),
    ).toBe(1);
    expect(
      await target.candidateScores.where("projectId").equals("project-restored").toArray(),
    ).toEqual([expect.objectContaining({ totalScore: 100, hardStatus: "pass" })]);
    expect(
      await target.candidateEvaluations.where("projectId").equals("project-restored").toArray(),
    ).toEqual([expect.objectContaining({ note: "含义与读音都喜欢" })]);
    source.close();
    target.close();
  });

  it("rejects an old backup as unsupported-format and leaves the database untouched", async () => {
    const target = createDatabase();
    const repository = new DexieBackupRepository(target);
    const legacy = {
      format: "erya-names-project-backup",
      schemaVersion: 4,
      payload: {},
    };

    await expect(new PreviewBackupImport(repository).execute(legacy)).resolves.toEqual({
      ok: false,
      error: "unsupported-format",
    });
    await expect(
      new ImportProjectBackup(repository, { createProjectId: () => "never" }).execute({
        envelope: legacy,
      }),
    ).resolves.toEqual({ ok: false, error: "unsupported-format" });
    expect(await target.projects.count()).toBe(0);
    target.close();
  });
});
