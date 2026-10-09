import type { GenerationRepository } from "../ports/GenerationRepository";
import type { ProjectRepository } from "../ports/ProjectRepository";
import { normalizeCandidateStage } from "../../domain/candidate/decision";
import { familyRulesArePending } from "../../domain/project/profile";

export type JourneyAvailability = "completed" | "available" | "blocked" | "optional";
export type JourneyStageId = "inbox" | "basic" | "folklore" | "compare" | "finalize";

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
        inbox: "blocked",
        basic: "blocked",
        folklore: "blocked",
        compare: "blocked",
        finalize: "blocked",
      };
    const counts = new Map<string, number>();
    let folkloreCompleted = false;
    for (const { decision } of records) {
      const stage = normalizeCandidateStage(decision.stage);
      counts.set(stage, (counts.get(stage) ?? 0) + 1);
      if (stage === "folklore_review" || decision.folkloreReviewed) folkloreCompleted = true;
    }
    const inbox = counts.get("inbox") ?? 0;
    const basic = counts.get("basic_shortlist") ?? 0;
    const folklore = counts.get("folklore_review") ?? 0;
    const compare = counts.get("comparison") ?? 0;
    const finalize = counts.get("finalist") ?? 0;
    const pending = familyRulesArePending(workspace.profile);
    return {
      inbox: batchCount > 0 ? "completed" : "available",
      basic:
        basic + folklore + compare + finalize > 0
          ? "completed"
          : inbox > 0
            ? "available"
            : "blocked",
      folklore: folkloreCompleted
        ? "completed"
        : basic + compare + finalize > 0
          ? "optional"
          : "blocked",
      compare:
        !pending && compare + finalize > 0
          ? "completed"
          : !pending && basic + folklore > 0
            ? "available"
            : "blocked",
      finalize:
        !pending && finalize > 0
          ? "completed"
          : !pending && compare > 0
            ? "available"
            : "blocked",
    };
  }
}
