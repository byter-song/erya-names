import { sha256 } from "../backup/checksum";
import type { AssessmentRepository } from "../ports/AssessmentRepository";
import type { ProjectRepository } from "../ports/ProjectRepository";
import { calculateBasicFiveElements } from "../../domain/folklore/calendarAdapter";
import {
  createProjectAssessment,
  projectAssessmentInput,
  projectAssessmentModuleIds,
  type ProjectAssessment,
  type ProjectAssessmentModuleId,
} from "../../domain/folklore/projectAssessment";
import { analyzeUsefulGod } from "../../domain/folklore/usefulGod";
import type { NamingProfile } from "../../domain/project/profile";
import { err, ok, type Result } from "../../domain/shared/result";

export interface AssessNamingProjectResult {
  assessments: ProjectAssessment[];
  reused: boolean;
}

export class AssessNamingProject {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly assessments: AssessmentRepository,
  ) {}

  async execute(input: {
    projectId: string;
    runId: string;
  }): Promise<Result<AssessNamingProjectResult, string>> {
    const [workspace, activeRun] = await Promise.all([
      this.projects.getWorkspace(input.projectId),
      this.assessments.getActiveRun(input.projectId),
    ]);
    if (!workspace) return err("project-not-found");
    if (!activeRun || activeRun.runId !== input.runId) return err("assessment-run-stale");

    const moduleIds = projectAssessmentModuleIds(workspace.profile);
    const existing = await this.assessments.listProjectAssessments({
      projectId: input.projectId,
      configRevision: workspace.profile.configRevision,
    });
    const calculated = await Promise.all(
      moduleIds.map(async (moduleId) => {
        const inputHash = await sha256(projectAssessmentInput(workspace.profile, moduleId));
        const cached = existing.find(
          (assessment) =>
            assessment.moduleId === moduleId && assessment.inputHash === inputHash,
        );
        return (
          cached ??
          createProjectAssessment({
            profile: workspace.profile,
            moduleId,
            inputHash,
            result: calculateModule(workspace.profile, moduleId),
          })
        );
      }),
    );
    const reused =
      calculated.length === existing.length &&
      calculated.every((assessment) =>
        existing.some(
          (cached) =>
            cached.moduleId === assessment.moduleId &&
            cached.inputHash === assessment.inputHash,
        ),
      );
    if (reused) return ok({ assessments: calculated, reused: true });

    const saved = await this.assessments.replaceProjectAssessments({
      projectId: input.projectId,
      runId: input.runId,
      configRevision: workspace.profile.configRevision,
      assessments: calculated,
    });
    return saved.ok ? ok({ assessments: calculated, reused: false }) : err(saved.error);
  }
}

function calculateModule(
  profile: NamingProfile,
  moduleId: ProjectAssessmentModuleId,
): Readonly<Record<string, unknown>> {
  const dateTime = profile.calendar.birthLocalDateTime;
  if (!dateTime)
    return {
      status: "missing_input",
      reason: "未填写出生日期，无法进行项目级民俗分析。",
    };

  try {
    const calendar = calculateBasicFiveElements({
      localDateTime: dateTime,
      timeZone: profile.calendar.timeZone,
      dayBoundary: profile.calendar.dayBoundary,
      timeKnown: profile.calendar.timeKnown,
    });
    if (moduleId === "zodiac")
      return {
        status: "applied",
        lunarZodiac: calendar.lunarZodiac,
        pillarZodiac: calendar.pillarZodiac,
        convention: profile.calendar.zodiacConvention,
        uncertainty: `${calendar.uncertainty} 生肖字根结论属于流派性提示，同一字根可能存在相反解释。`,
      };

    const monthBranch = calendar.pillars[1]?.[1] ?? "";
    const usefulGod = analyzeUsefulGod({
      pillars: calendar.pillars,
      dayMasterElement: calendar.dayMasterElement,
      distribution: calendar.distribution,
      monthBranch,
      ...(profile.usefulGodDecision
        ? { confirmedElements: profile.usefulGodDecision.confirmedElements }
        : {}),
    });
    return {
      status: usefulGod.scoringApplicability,
      calendar,
      usefulGod,
    };
  } catch (error) {
    return {
      status: "missing_input",
      reason: error instanceof Error ? error.message : "出生信息无法解析。",
    };
  }
}
