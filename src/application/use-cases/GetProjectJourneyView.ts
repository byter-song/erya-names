import type { CandidatePool } from "../../domain/candidate/decision";
import { familyRulesArePending } from "../../domain/project/profile";
import type { GenerationRepository } from "../ports/GenerationRepository";
import type { ProjectRepository } from "../ports/ProjectRepository";

export type JourneyAvailability = "completed" | "available" | "blocked";
export type JourneyStageId =
  "configuration" | "inspiration" | "candidate" | "selected" | "export";

export class GetProjectJourneyView {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly generations: GenerationRepository,
  ) {}

  async execute(projectId: string): Promise<Record<JourneyStageId, JourneyAvailability>> {
    const [workspace, records, batchCount] = await Promise.all([
      this.projects.getWorkspace(projectId),
      this.generations.listCandidates(projectId),
      this.generations.countBatches(projectId),
    ]);
    if (!workspace)
      return {
        configuration: "blocked",
        inspiration: "blocked",
        candidate: "blocked",
        selected: "blocked",
        export: "blocked",
      };

    const counts: Record<CandidatePool, number> = {
      inspiration: 0,
      candidate: 0,
      selected: 0,
      excluded: 0,
    };
    for (const { decision } of records) counts[decision.pool] += 1;

    const hasGenerated = batchCount > 0 || records.length > 0;
    const hasAdvanced = counts.candidate + counts.selected > 0;
    const profile = workspace.profile;
    const birthInputRequired =
      profile.modules.bazi_wuxing.analysisEnabled || profile.modules.zodiac.analysisEnabled;
    const configurationReady =
      !familyRulesArePending(profile.family) &&
      (!birthInputRequired || Boolean(profile.calendar.birthLocalDateTime));
    return {
      configuration: configurationReady ? "completed" : "available",
      inspiration: hasGenerated ? "completed" : "available",
      candidate: hasAdvanced ? "completed" : counts.inspiration > 0 ? "available" : "blocked",
      selected:
        counts.selected > 0 ? "completed" : counts.candidate > 0 ? "available" : "blocked",
      export: counts.selected > 0 ? "available" : "blocked",
    };
  }
}
