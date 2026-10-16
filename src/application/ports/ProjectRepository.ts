import type { NamingProfile } from "../../domain/project/profile";
import type { NamingProject } from "../../domain/project/project";
import type { AssessmentRun } from "../../domain/rules/assessmentRun";
import type { Result } from "../../domain/shared/result";

export interface ProjectWorkspace {
  project: NamingProject;
  profile: NamingProfile;
}

export type ProjectWriteError =
  | "project-not-found"
  | "project-id-conflict"
  | "project-stale"
  | "configuration-stale"
  | "invalid-project-write";

export type ConfigurationWrite =
  | { kind: "display-only"; workspace: ProjectWorkspace }
  | {
      kind: "scoring-inputs-changed";
      workspace: ProjectWorkspace;
      assessmentRun: AssessmentRun;
    };

/** Owns the transaction boundary for project and profile writes. */
export interface ProjectRepository {
  create(workspace: ProjectWorkspace): Promise<Result<void, ProjectWriteError>>;
  deleteProject(projectId: string): Promise<Result<void, ProjectWriteError>>;
  listProjects(): Promise<NamingProject[]>;
  getWorkspace(projectId: string): Promise<ProjectWorkspace | undefined>;
  rename(input: {
    projectId: string;
    title: string;
    expectedUpdatedAt: string;
    updatedAt: string;
  }): Promise<Result<NamingProject, ProjectWriteError>>;
  /** Creates only the supplied project/profile pair; no project-owned child data is copied. */
  copyConfiguration(input: {
    sourceProjectId: string;
    workspace: ProjectWorkspace;
  }): Promise<Result<ProjectWorkspace, ProjectWriteError>>;
  /**
   * Compares expectedRevision and atomically writes project/profile. A scoring change advances
   * configRevision by one and installs its active assessment run in the same transaction;
   * a display-only change retains the revision.
   */
  saveConfiguration(input: {
    projectId: string;
    expectedRevision: number;
    write: ConfigurationWrite;
  }): Promise<Result<ConfigurationWrite, ProjectWriteError>>;
}
