import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { ExportProjectBackup } from "../../src/application/use-cases/ExportProjectBackup";
import { EryaDatabase } from "../../src/infrastructure/database/EryaDatabase";
import { DexieBackupRepository } from "../../src/infrastructure/repositories/DexieBackupRepository";
import { namingProfileFixture } from "../fixtures/namingProfile";
import { namingProjectFixture } from "../fixtures/namingProject";

const databaseNames = new Set<string>();

afterEach(async () => {
  await Promise.all([...databaseNames].map((name) => EryaDatabase.delete(name)));
  databaseNames.clear();
});

describe("ExportProjectBackup", () => {
  it("exports every project-owned table without leaking another project", async () => {
    const name = `erya-backup-${crypto.randomUUID()}`;
    databaseNames.add(name);
    const database = new EryaDatabase(name);
    await database.projects.bulkAdd([
      namingProjectFixture(),
      { ...namingProjectFixture("project-li"), title: "李姓宝宝起名" },
    ]);
    await database.profiles.add(namingProfileFixture());
    await database.candidates.add({
      id: "candidate-song",
      projectId: "project-song",
      batchId: "batch-1",
      normalizedFingerprint: "宋清扬",
      surname: "宋",
      givenName: "清扬",
      fullName: "宋清扬",
      pinyin: ["sòng", "qīng", "yáng"],
      sourceType: "verified_allusion",
      summary: "清秀明朗",
      sourceIds: [],
      sourceEvidence: [],
      warnings: [],
      riskSignals: [],
      ruleResults: [],
      styleTags: [],
      characterElements: [],
      createdAt: "2026-09-17T01:00:00.000Z",
    });
    await database.candidates.add({
      id: "candidate-song-2",
      projectId: "project-song",
      batchId: "batch-1",
      normalizedFingerprint: "宋知远",
      surname: "宋",
      givenName: "知远",
      fullName: "宋知远",
      pinyin: ["sòng", "zhī", "yuǎn"],
      sourceType: "verified_allusion",
      summary: "志向高远",
      sourceIds: [],
      sourceEvidence: [],
      warnings: [],
      riskSignals: [],
      ruleResults: [],
      styleTags: [],
      characterElements: [],
      createdAt: "2026-09-17T01:00:00.000Z",
    });
    await database.generationBatches.add({
      id: "batch-1",
      projectId: "project-song",
      sequence: 1,
      seed: "seed",
      requestedCount: 1,
      profileSnapshot: namingProfileFixture(),
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
      createdAt: "2026-09-17T01:00:00.000Z",
    });
    await database.candidateSources.add({
      id: "source-1",
      projectId: "project-song",
      candidateId: "candidate-song",
      sourceId: "shijing",
    });
    await database.ruleResults.add({
      id: "rule-1",
      projectId: "project-song",
      candidateId: "candidate-song",
      evidenceLevel: "L1",
      outcome: "pass",
      ruleId: "l1",
      ruleVersion: "1",
      explanation: "通过",
      sourceRefs: [],
    });
    await database.candidateDecisions.add({
      candidateId: "candidate-song",
      projectId: "project-song",
      stage: "finalist",
      updatedAt: "2026-09-17T01:10:00.000Z",
    });
    await database.finalDecisions.add({
      projectId: "project-song",
      selectedCandidateId: "candidate-song",
      rationale: "喜欢",
      updatedAt: "2026-09-17T02:00:00.000Z",
    });
    await database.decisionHistory.add({
      projectId: "project-song",
      candidateId: "candidate-song",
      from: "inbox",
      to: "favorite",
      changedAt: "2026-09-17T01:10:00.000Z",
    });
    await database.candidateEvaluations.add({
      projectId: "project-song",
      candidateId: "candidate-song",
      rating: 5,
      updatedAt: "2026-09-17T01:10:00.000Z",
    });
    await database.comparisonSnapshots.add({
      id: "snapshot-1",
      projectId: "project-song",
      name: "第一轮",
      candidateIds: ["candidate-song", "candidate-song-2"],
      candidates: [
        {
          id: "candidate-song",
          fullName: "宋清扬",
          pinyin: ["sòng", "qīng", "yáng"],
          sourceType: "verified_allusion",
          summary: "清秀明朗",
          sourceEvidence: [],
          warnings: [],
          ruleEvidence: [],
        },
        {
          id: "candidate-song-2",
          fullName: "宋知远",
          pinyin: ["sòng", "zhī", "yuǎn"],
          sourceType: "verified_allusion",
          summary: "志向高远",
          sourceEvidence: [],
          warnings: [],
          ruleEvidence: [],
        },
      ],
      createdAt: "2026-09-17T01:20:00.000Z",
    });

    const result = await new ExportProjectBackup(new DexieBackupRepository(database), {
      appVersion: "0.2.0",
      datasetVersion: "dev-2026.09.17",
      rulePackVersion: "core-rules-1",
      now: () => "2026-09-17T10:00:00.000Z",
    }).execute("project-song");

    if (!result.ok) throw new Error(result.error);
    expect(result.value.payload.projects).toHaveLength(1);
    expect(result.value.payload.projects[0]).toMatchObject({ id: "project-song" });
    expect(result.value.payload.candidates).toHaveLength(2);
    for (const table of [
      "profiles",
      "generationBatches",
      "candidateSources",
      "ruleResults",
      "candidateDecisions",
      "decisionHistory",
      "candidateEvaluations",
      "comparisonSnapshots",
      "finalDecisions",
    ] as const) {
      expect(result.value.payload[table], table).toHaveLength(1);
    }
    expect(result.value.payload.finalDecisions).toHaveLength(1);
    expect(JSON.stringify(result.value.payload)).not.toContain("project-li");
    database.close();
  });
});
