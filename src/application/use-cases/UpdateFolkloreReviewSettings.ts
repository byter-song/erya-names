import type { GenerationRepository } from "../ports/GenerationRepository";
import type { ProjectRepository, ProjectWorkspace } from "../ports/ProjectRepository";
import { namingProfileSchema, type NamingProfile } from "../../domain/project/profile";
import { namingProjectSchema } from "../../domain/project/project";
import { scoreBasicFiveElements } from "../../domain/rules/l4/basicFiveElements";
import type { CandidateRuleResult } from "../../domain/rules/types";
import { err, ok, type Result } from "../../domain/shared/result";

export class UpdateFolkloreReviewSettings {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly generations: GenerationRepository,
    private readonly dependencies: { now: () => string },
  ) {}

  async execute(input: {
    projectId: string;
    folklore: NamingProfile["folklore"];
  }): Promise<Result<ProjectWorkspace, string>> {
    const current = await this.projects.getWorkspace(input.projectId);
    if (!current) return err("project-not-found");
    if (!this.projects.updateFolkloreReview) return err("folklore-review-not-supported");

    try {
      const profile = namingProfileSchema.parse({
        ...current.profile,
        folklore: input.folklore,
      });
      const project = namingProjectSchema.parse({
        ...current.project,
        updatedAt: this.dependencies.now(),
      });
      const candidates = await this.generations.listCandidates(input.projectId, [
        "folklore_review",
      ]);
      const candidateResults = candidates.map(({ candidate }) => ({
        candidateId: candidate.id,
        result: createFolkloreResult(profile.folklore, candidate.characterElements),
      }));
      const workspace = { project, profile };
      await this.projects.updateFolkloreReview({
        expectedProjectUpdatedAt: current.project.updatedAt,
        workspace,
        candidateResults,
      });
      return ok(workspace);
    } catch (error) {
      return err(error instanceof Error ? error.message : "folklore-review-update-failed");
    }
  }
}

function createFolkloreResult(
  folklore: NamingProfile["folklore"],
  characterElements: Array<"wood" | "fire" | "earth" | "metal" | "water">,
): CandidateRuleResult | undefined {
  const score = scoreBasicFiveElements({
    enabled: folklore.enabled,
    usefulElements: folklore.usefulElements,
    includeInRanking: folklore.includeInRanking,
    characterElements,
  });
  if (!score) return undefined;
  return {
    evidenceLevel: "L4",
    outcome: "pass",
    ruleId: score.ruleId,
    ruleVersion: score.ruleVersion,
    sourceRefs: [],
    explanation: score.explanation,
    scoreDelta: score.scoreDelta,
  };
}
