export interface BackupRepository {
  exportProject(projectId: string): Promise<unknown | undefined>;
  hasProject(projectId: string): Promise<boolean>;
  importProject(
    payload: unknown,
    options: { strategy: "keep-current" | "replace" | "import-copy"; copyProjectId?: string },
  ): Promise<{ projectId: string; action: "kept" | "replaced" | "imported" }>;
}
