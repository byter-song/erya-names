import type { FolkloreModuleId, NamingProfile } from "../project/profile";

export interface ProjectAssessment {
  id: string;
  projectId: string;
  moduleId: FolkloreModuleId;
  configRevision: number;
  inputHash: string;
  result: Readonly<Record<string, unknown>>;
}

export type ProjectAssessmentModuleId = Extract<FolkloreModuleId, "bazi_wuxing" | "zodiac">;

export function projectAssessmentModuleIds(
  profile: NamingProfile,
): ProjectAssessmentModuleId[] {
  return (["bazi_wuxing", "zodiac"] as const).filter((moduleId) => {
    const module = profile.modules[moduleId];
    return module.analysisEnabled || module.detailsVisible;
  });
}

/** Inputs that can change a project-level result. detailsVisible is excluded. */
export function projectAssessmentInput(
  profile: NamingProfile,
  moduleId: ProjectAssessmentModuleId,
) {
  const module = profile.modules[moduleId];
  return {
    moduleId,
    calendar: profile.calendar,
    module: {
      analysisEnabled: module.analysisEnabled,
      weight: module.weight,
      schoolId: module.schoolId,
      ruleVersion: module.ruleVersion,
    },
    ...(moduleId === "bazi_wuxing" ? { usefulGodDecision: profile.usefulGodDecision } : {}),
  };
}

export function createProjectAssessment(input: {
  profile: NamingProfile;
  moduleId: ProjectAssessmentModuleId;
  inputHash: string;
  result: Readonly<Record<string, unknown>>;
}): ProjectAssessment {
  return {
    id: `${input.profile.projectId}:${input.moduleId}`,
    projectId: input.profile.projectId,
    moduleId: input.moduleId,
    configRevision: input.profile.configRevision,
    inputHash: input.inputHash,
    result: input.result,
  };
}
