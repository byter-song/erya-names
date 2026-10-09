import { describe, expect, it } from "vitest";
import {
  createBackupEnvelope,
  validateBackupEnvelope,
} from "../../../src/application/backup/backupSchema";
import { namingProfileFixture } from "../../fixtures/namingProfile";
import { namingProjectFixture } from "../../fixtures/namingProject";
import { sha256 } from "../../../src/application/backup/checksum";

const payload = {
  projectId: "project-song",
  projects: [namingProjectFixture()],
  profiles: [namingProfileFixture()],
  generationBatches: [],
  candidates: [],
  candidateSources: [],
  ruleResults: [],
  candidateDecisions: [],
  decisionHistory: [],
  candidateEvaluations: [],
  comparisonSnapshots: [],
  finalDecisions: [],
};

describe("project backup envelope", () => {
  it("creates and validates a complete checksummed envelope", async () => {
    const envelope = await createBackupEnvelope({
      payload,
      appVersion: "0.2.0",
      datasetVersion: "dev-2026.09.17",
      rulePackVersion: "core-rules-1",
      exportedAt: "2026-09-17T10:00:00.000Z",
    });

    await expect(validateBackupEnvelope(envelope)).resolves.toEqual(envelope);
    expect(envelope.checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it("upgrades a valid schema v2 envelope to schema v3", async () => {
    const legacy = {
      format: "erya-names-project-backup",
      schemaVersion: 2,
      appVersion: "0.3.0",
      datasetVersion: "personal",
      rulePackVersion: "rules",
      exportedAt: "2026-10-08T00:00:00.000Z",
      checksum: await sha256(payload),
      payload,
    };

    await expect(validateBackupEnvelope(legacy)).resolves.toMatchObject({
      schemaVersion: 3,
      payload,
    });
  });

  it("rejects missing fields, unsupported versions and changed payloads", async () => {
    const envelope = await createBackupEnvelope({
      payload,
      appVersion: "0.2.0",
      datasetVersion: "dev-2026.09.17",
      rulePackVersion: "core-rules-1",
      exportedAt: "2026-09-17T10:00:00.000Z",
    });

    await expect(validateBackupEnvelope({ ...envelope, format: "unknown" })).rejects.toThrow(
      /format/i,
    );
    await expect(validateBackupEnvelope({ ...envelope, schemaVersion: 99 })).rejects.toThrow(
      /schema/i,
    );
    await expect(
      validateBackupEnvelope({
        ...envelope,
        payload: {
          ...envelope.payload,
          projects: [{ ...envelope.payload.projects[0], title: "已篡改" }],
        },
      }),
    ).rejects.toThrow(/checksum/i);
  });

  it("rejects incomplete records, foreign projects and dangling references before checksumming", async () => {
    const base = structuredClone(payload);
    await expect(
      createBackupEnvelope({
        payload: {
          ...base,
          generationBatches: [{ id: "batch-incomplete", projectId: "project-song" }],
        },
        appVersion: "0.2.0",
        datasetVersion: "dev",
        rulePackVersion: "rules",
        exportedAt: "2026-09-17T10:00:00.000Z",
      }),
    ).rejects.toThrow();

    await expect(
      createBackupEnvelope({
        payload: {
          ...base,
          profiles: [namingProfileFixture("foreign-project")],
        },
        appVersion: "0.2.0",
        datasetVersion: "dev",
        rulePackVersion: "rules",
        exportedAt: "2026-09-17T10:00:00.000Z",
      }),
    ).rejects.toThrow(/project/i);

    await expect(
      createBackupEnvelope({
        payload: {
          ...base,
          candidateDecisions: [
            {
              projectId: "project-song",
              candidateId: "missing-candidate",
              stage: "favorite",
              updatedAt: "2026-09-17T10:00:00.000Z",
            },
          ],
        },
        appVersion: "0.2.0",
        datasetVersion: "dev",
        rulePackVersion: "rules",
        exportedAt: "2026-09-17T10:00:00.000Z",
      }),
    ).rejects.toThrow(/candidate/i);

    const foreignSnapshotProfile = namingProfileFixture("foreign-project");
    await expect(
      createBackupEnvelope({
        payload: {
          ...base,
          generationBatches: [
            {
              id: "batch-1",
              projectId: "project-song",
              sequence: 1,
              seed: "seed",
              requestedCount: 1,
              profileSnapshot: foreignSnapshotProfile,
              datasetVersion: "dev",
              rulePackVersion: "rules",
              status: "completed",
              statistics: {
                sourceCandidates: 1,
                hardRejected: 0,
                duplicateRejected: 0,
                historicalRejected: 0,
                persisted: 0,
              },
              createdAt: "2026-09-17T10:00:00.000Z",
            },
          ],
        },
        appVersion: "0.2.0",
        datasetVersion: "dev",
        rulePackVersion: "rules",
        exportedAt: "2026-09-17T10:00:00.000Z",
      }),
    ).rejects.toThrow(/snapshot project/i);
  });

  it("verifies a legacy v1 checksum before normalizing derived candidate fields", async () => {
    const legacyPayload = {
      ...structuredClone(payload),
      candidates: [
        {
          id: "c1",
          projectId: "project-song",
          batchId: null,
          normalizedFingerprint: "宋清扬",
          surname: "宋",
          givenName: "清扬",
          fullName: "宋清扬",
          pinyin: ["sòng", "qīng", "yáng"],
          sourceType: "user_input",
          summary: "清朗",
          sourceIds: [],
          sourceEvidence: [],
          warnings: [],
          riskSignals: [],
          ruleResults: [],
          createdAt: "2026-09-17T10:00:00.000Z",
        },
      ],
    };
    const envelope = {
      format: "erya-names-project-backup",
      schemaVersion: 1,
      appVersion: "0.1.0",
      datasetVersion: "dev",
      rulePackVersion: "rules",
      exportedAt: "2026-09-17T10:00:00.000Z",
      checksum: await sha256(legacyPayload),
      payload: legacyPayload,
    };

    await expect(validateBackupEnvelope(envelope)).resolves.toMatchObject({
      payload: { candidates: [{ styleTags: [], characterElements: [] }] },
    });
  });

  it("drops an invalid one-candidate legacy v1 snapshot after verifying its checksum", async () => {
    const legacyPayload = {
      ...structuredClone(payload),
      comparisonSnapshots: [
        {
          id: "legacy-invalid",
          projectId: "project-song",
          candidateIds: ["candidate-1"],
          createdAt: "2026-09-17T10:00:00.000Z",
        },
      ],
    };
    const envelope = {
      format: "erya-names-project-backup",
      schemaVersion: 1,
      appVersion: "0.1.0",
      datasetVersion: "dev",
      rulePackVersion: "rules",
      exportedAt: "2026-09-17T10:00:00.000Z",
      checksum: await sha256(legacyPayload),
      payload: legacyPayload,
    };

    await expect(validateBackupEnvelope(envelope)).resolves.toMatchObject({
      schemaVersion: 3,
      payload: { comparisonSnapshots: [] },
    });
  });
});
