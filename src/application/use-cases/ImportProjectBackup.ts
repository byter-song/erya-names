import type { BackupRepository } from "../ports/BackupRepository";
import { validateBackupEnvelope } from "../../infrastructure/backup/backupSchema";
import { err, ok, type Result } from "../../domain/shared/result";

export class ImportProjectBackup {
  constructor(
    private readonly repository: BackupRepository,
    private readonly dependencies: { createProjectId: () => string },
  ) {}

  async execute(input: {
    envelope: unknown;
    conflictStrategy?: "keep-current" | "replace" | "import-copy";
  }): Promise<Result<{ projectId: string; action: "kept" | "replaced" | "imported" }, string>> {
    try {
      const envelope = await validateBackupEnvelope(input.envelope);
      const conflict = await this.repository.hasProject(envelope.payload.projectId);
      if (conflict && !input.conflictStrategy) return err("conflict-strategy-required");
      const strategy = input.conflictStrategy ?? "replace";
      return ok(
        await this.repository.importProject(envelope.payload, {
          strategy,
          ...(strategy === "import-copy"
            ? { copyProjectId: this.dependencies.createProjectId() }
            : {}),
        }),
      );
    } catch (error) {
      return err(error instanceof Error ? error.message : "backup-import-failed");
    }
  }
}
