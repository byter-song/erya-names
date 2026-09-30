import type { NamingProfile } from "../../domain/project/profile";
import type { NamingProject } from "../../domain/project/project";

export interface ProjectWorkspace {
  project: NamingProject;
  profile: NamingProfile;
}

export interface ProjectRepository {
  create(workspace: ProjectWorkspace): Promise<void>;
  deleteProject(projectId: string): Promise<boolean>;
  listProjects(): Promise<NamingProject[]>;
  getWorkspace(projectId: string): Promise<ProjectWorkspace | undefined>;
  updateProfile(input: { project: NamingProject; profile: NamingProfile }): Promise<void>;
}
