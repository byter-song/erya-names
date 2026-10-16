import type { BackupPayload } from "../backup/backupSchema";

export type BackupConflictStrategy = "keep-current" | "replace" | "import-copy";
export type BackupImportAction = "kept" | "replaced" | "imported";

export interface BackupRepository {
  exportProject(projectId: string): Promise<BackupPayload | undefined>;
  hasProject(projectId: string): Promise<boolean>;
  importProject(
    payload: BackupPayload,
    options: { strategy: BackupConflictStrategy; copyProjectId?: string },
  ): Promise<{ projectId: string; action: BackupImportAction }>;
}
