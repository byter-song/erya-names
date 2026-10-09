import type { BackupRepository } from "../ports/BackupRepository";
import type { BackupEnvelope } from "../backup/backupSchema";
import { createBackupEnvelope } from "../backup/backupSchema";
import { err, ok, type Result } from "../../domain/shared/result";

export class ExportProjectBackup {
  constructor(
    private readonly repository: BackupRepository,
    private readonly dependencies: {
      appVersion: string;
      datasetVersion: string;
      rulePackVersion: string;
      now: () => string;
    },
  ) {}

  async execute(projectId: string): Promise<Result<BackupEnvelope, string>> {
    try {
      const payload = await this.repository.exportProject(projectId);
      if (!payload) return err("project-not-found");
      return ok(
        await createBackupEnvelope({
          payload,
          ...this.dependencies,
          exportedAt: this.dependencies.now(),
        }),
      );
    } catch (error) {
      return err(error instanceof Error ? error.message : "backup-export-failed");
    }
  }
}
