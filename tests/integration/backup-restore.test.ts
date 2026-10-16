import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import {
  BACKUP_FORMAT,
  BACKUP_SCHEMA_VERSION,
  createBackupEnvelope,
} from "../../src/application/backup/backupSchema";
import { ImportProjectBackup } from "../../src/application/use-cases/ImportProjectBackup";
import { PreviewBackupImport } from "../../src/application/use-cases/PreviewBackupImport";
import { EryaDatabase } from "../../src/infrastructure/database/EryaDatabase";
import { DexieBackupRepository } from "../../src/infrastructure/repositories/DexieBackupRepository";
import { namingProfileFixture } from "../fixtures/namingProfile";
import { namingProjectFixture } from "../fixtures/namingProject";

const names = new Set<string>();
afterEach(async () => {
  await Promise.all([...names].map((name) => EryaDatabase.delete(name)));
  names.clear();
});

function createDatabase(): EryaDatabase {
  const name = `erya-restore-${crypto.randomUUID()}`;
  names.add(name);
  return new EryaDatabase(name);
}

async function seedFullProject(database: EryaDatabase, projectId = "project-song") {
  const profile = namingProfileFixture(projectId);
  await database.projects.add(namingProjectFixture(projectId));
  await database.profiles.add(profile);
  await database.generationBatches.add({
    id: "batch-1",
    projectId,
    sequence: 1,
    seed: "seed",
    requestedCount: 1,
    profileSnapshot: profile,
    datasetVersion: "dev",
    rulePackVersion: "rules",
    status: "completed",
    statistics: {
      sourceCandidates: 1,
      hardRejected: 0,
      duplicateRejected: 0,
      historicalRejected: 0,
      persisted: 1,
    },
    createdAt: "2026-10-16T01:00:00.000Z",
  });
  await database.candidates.add({
    id: "candidate-1",
    projectId,
    batchId: "batch-1",
    normalizedFingerprint: "宋清扬",
    surname: "宋",
    givenName: "清扬",
    fullName: "宋清扬",
    pinyin: ["sòng", "qīng", "yáng"],
    sourceType: "verified_allusion",
    summary: "清秀明朗",
    createdAt: "2026-10-16T01:00:00.000Z",
  });
  await database.candidateSources.add({
    id: "source-1",
    projectId,
    candidateId: "candidate-1",
    sourceId: "shijing",
    work: "诗经",
  });
  await database.candidateDecisions.add({
    projectId,
    candidateId: "candidate-1",
    pool: "selected",
    updatedAt: "2026-10-16T02:00:00.000Z",
  });
  await database.decisionHistory.add({
    projectId,
    candidateId: "candidate-1",
    from: "candidate",
    to: "selected",
    action: "forward",
    changedAt: "2026-10-16T02:00:00.000Z",
  });
  await database.candidateEvaluations.add({
    projectId,
    candidateId: "candidate-1",
    rating: 5,
    note: "喜欢",
    updatedAt: "2026-10-16T02:00:00.000Z",
  });
  await database.projectAssessments.add({
    id: "assessment-1",
    projectId,
    moduleId: "zodiac",
    configRevision: 0,
    inputHash: "profile-hash",
    result: { zodiac: "dragon" },
  });
  await database.ruleEvidence.add({
    id: "evidence-1",
    projectId,
    candidateId: "candidate-1",
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
    candidateId: "candidate-1",
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
    runId: "run-1",
    configRevision: 0,
    status: "completed",
    completed: 1,
    total: 1,
  });
  await database.appMetadata.add({
    key: `project:${projectId}:report-layout`,
    value: "compact",
  });
}

async function exportEnvelope(database: EryaDatabase) {
  const payload = await new DexieBackupRepository(database).exportProject("project-song");
  return createBackupEnvelope({
    payload,
    appVersion: "1.0.0",
    datasetVersion: "dev",
    rulePackVersion: "rules",
    exportedAt: "2026-10-16T10:00:00.000Z",
  });
}

describe("v2 backup restore", () => {
  it("exports one explicit array for every v2 table and previews without writing", async () => {
    const source = createDatabase();
    await seedFullProject(source);
    const envelope = await exportEnvelope(source);
    expect(envelope).toMatchObject({
      format: BACKUP_FORMAT,
      schemaVersion: BACKUP_SCHEMA_VERSION,
    });
    expect(Object.keys(envelope.payload).sort()).toEqual(
      [
        "projectId",
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
      ].sort(),
    );

    const target = createDatabase();
    await expect(
      new PreviewBackupImport(new DexieBackupRepository(target)).execute(envelope),
    ).resolves.toMatchObject({
      ok: true,
      value: { conflict: "none", counts: { candidates: 1, ruleEvidence: 1 } },
    });
    expect(await target.projects.count()).toBe(0);
    source.close();
    target.close();
  });

  it("imports a copy with all project and candidate references remapped", async () => {
    const source = createDatabase();
    await seedFullProject(source);
    const target = createDatabase();
    const result = await new ImportProjectBackup(new DexieBackupRepository(target), {
      createProjectId: () => "project-copy",
    }).execute({
      envelope: await exportEnvelope(source),
      conflictStrategy: "import-copy",
    });

    expect(result).toMatchObject({ ok: true, value: { projectId: "project-copy" } });
    const candidate = (await target.candidates.toArray())[0];
    expect(candidate?.projectId).toBe("project-copy");
    await expect(target.candidateDecisions.get(candidate?.id ?? "")).resolves.toMatchObject({
      projectId: "project-copy",
      pool: "selected",
    });
    expect((await target.ruleEvidence.toArray())[0]?.candidateId).toBe(candidate?.id);
    expect((await target.candidateScores.toArray())[0]?.candidateId).toBe(candidate?.id);
    expect((await target.assessmentRuns.toArray())[0]).toMatchObject({
      projectId: "project-copy",
    });
    expect((await target.appMetadata.toArray())[0]?.key).toBe(
      "project:project-copy:report-layout",
    );
    source.close();
    target.close();
  });

  it("rejects legacy payload fields and rolls back a failed replacement", async () => {
    const source = createDatabase();
    await seedFullProject(source);
    const envelope = await exportEnvelope(source);
    await expect(
      createBackupEnvelope({
        payload: { ...envelope.payload, finalDecisions: [] },
        appVersion: "1.0.0",
        datasetVersion: "dev",
        rulePackVersion: "rules",
        exportedAt: "2026-10-16T10:00:00.000Z",
      }),
    ).rejects.toThrow();

    const target = createDatabase();
    await target.projects.add({
      ...namingProjectFixture(),
      title: "现有方案",
    });
    const repository = new DexieBackupRepository(target, {
      beforeWrite: () => {
        throw new Error("injected-write-failure");
      },
    });
    await expect(
      new ImportProjectBackup(repository, { createProjectId: () => "unused" }).execute({
        envelope,
        conflictStrategy: "replace",
      }),
    ).resolves.toEqual({ ok: false, error: "injected-write-failure" });
    await expect(target.projects.get("project-song")).resolves.toMatchObject({
      title: "现有方案",
    });
    source.close();
    target.close();
  });
});
