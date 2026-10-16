import { describe, expect, it } from "vitest";
import {
  BACKUP_FORMAT,
  BACKUP_SCHEMA_VERSION,
  BackupValidationError,
  createBackupEnvelope,
  validateBackupEnvelope,
} from "../../../src/application/backup/backupSchema";
import { sha256 } from "../../../src/application/backup/checksum";
import { namingProfileFixture } from "../../fixtures/namingProfile";
import { namingProjectFixture } from "../../fixtures/namingProject";

const payload = {
  projectId: "project-song",
  projects: [namingProjectFixture()],
  profiles: [namingProfileFixture()],
  generationBatches: [],
  candidates: [],
  candidateSources: [],
  candidateDecisions: [],
  decisionHistory: [],
  candidateEvaluations: [],
  projectAssessments: [],
  ruleEvidence: [],
  candidateScores: [],
  assessmentRuns: [],
  appMetadata: [],
};

const envelopeInput = {
  appVersion: "1.0.0",
  datasetVersion: "personal-2026.10.16",
  rulePackVersion: "folklore-rules-1",
  exportedAt: "2026-10-16T10:00:00.000Z",
};

describe("v2 project backup v1 envelope", () => {
  it("creates and validates the only supported format with a canonical payload checksum", async () => {
    const envelope = await createBackupEnvelope({ payload, ...envelopeInput });

    expect(envelope).toMatchObject({
      format: BACKUP_FORMAT,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      checksum: await sha256(payload),
    });
    await expect(validateBackupEnvelope(envelope)).resolves.toEqual(envelope);
  });

  it.each([
    ["legacy v1", "erya-names-project-backup", 1],
    ["legacy v4", "erya-names-project-backup", 4],
    ["future v2 schema", BACKUP_FORMAT, 2],
    ["unknown format", "unknown", 1],
  ])("rejects %s as unsupported-format without migration", async (_, format, schemaVersion) => {
    const legacyPayload = { ...payload, finalDecisions: [] };
    const input = {
      format,
      schemaVersion,
      ...envelopeInput,
      checksum: await sha256(legacyPayload),
      payload: legacyPayload,
    };

    await expect(validateBackupEnvelope(input)).rejects.toMatchObject<BackupValidationError>({
      code: "unsupported-format",
    });
  });

  it("reports invalid-checksum when a valid v2 payload was changed", async () => {
    const envelope = await createBackupEnvelope({ payload, ...envelopeInput });
    const changed = {
      ...envelope,
      payload: {
        ...envelope.payload,
        projects: [{ ...envelope.payload.projects[0], title: "已篡改" }],
      },
    };

    await expect(validateBackupEnvelope(changed)).rejects.toMatchObject<BackupValidationError>({
      code: "invalid-checksum",
    });
  });

  it.each([
    {
      name: "legacy table",
      changed: { ...payload, finalDecisions: [] },
    },
    {
      name: "foreign profile",
      changed: { ...payload, profiles: [namingProfileFixture("foreign-project")] },
    },
    {
      name: "foreign metadata",
      changed: { ...payload, appMetadata: [{ key: "project:foreign:layout", value: "wide" }] },
    },
    {
      name: "dangling decision",
      changed: {
        ...payload,
        candidateDecisions: [
          {
            projectId: "project-song",
            candidateId: "missing-candidate",
            pool: "selected",
            updatedAt: "2026-10-16T10:00:00.000Z",
          },
        ],
      },
    },
  ])("rejects invalid-payload: $name", async ({ changed }) => {
    const input = {
      format: BACKUP_FORMAT,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      ...envelopeInput,
      checksum: await sha256(changed),
      payload: changed,
    };

    await expect(validateBackupEnvelope(input)).rejects.toMatchObject<BackupValidationError>({
      code: "invalid-payload",
    });
  });
});
