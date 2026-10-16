import type {
  BackupConflictStrategy,
  BackupImportAction,
  BackupRepository,
} from "../ports/BackupRepository";
import { backupValidationErrorCode, validateBackupEnvelope } from "../backup/backupSchema";
import { err, ok, type Result } from "../../domain/shared/result";

export class ImportProjectBackup {
  constructor(
    private readonly repository: BackupRepository,
    private readonly dependencies: { createProjectId: () => string },
  ) {}

  async execute(input: {
    envelope: unknown;
    conflictStrategy?: BackupConflictStrategy;
  }): Promise<Result<{ projectId: string; action: BackupImportAction }, string>> {
    try {
      const envelope = await validateBackupEnvelope(input.envelope);
      const conflict = await this.repository.hasProject(envelope.payload.projectId);
      if (conflict && !input.conflictStrategy) return err("conflict-strategy-required");
      const strategy = input.conflictStrategy ?? "replace";
      const copyProjectId =
        strategy === "import-copy"
          ? await this.createAvailableProjectId(envelope.payload.projectId)
          : undefined;
      if (strategy === "import-copy" && !copyProjectId)
        return err("project-id-generation-failed");
      return ok(
        await this.repository.importProject(envelope.payload, {
          strategy,
          ...(copyProjectId ? { copyProjectId } : {}),
        }),
      );
    } catch (error) {
      return err(
        backupValidationErrorCode(error) ??
          (error instanceof Error ? error.message : "backup-import-failed"),
      );
    }
  }

  private async createAvailableProjectId(sourceProjectId: string): Promise<string | undefined> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = this.dependencies.createProjectId();
      if (candidate !== sourceProjectId && !(await this.repository.hasProject(candidate)))
        return candidate;
    }
    return undefined;
  }
}
