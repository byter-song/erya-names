import type { CandidatePool } from "../../domain/candidate/decision";
import type { CandidateScore } from "../../domain/rules/candidateScore";
import type { CandidateFunnelItem } from "../models/CandidateFunnelItem";
import type { AssessmentRepository } from "../ports/AssessmentRepository";
import type { EvaluationRepository } from "../ports/EvaluationRepository";
import type { GenerationRepository } from "../ports/GenerationRepository";
import type { ProjectRepository } from "../ports/ProjectRepository";

const poolOrder: Record<CandidatePool, number> = {
  inspiration: 0,
  candidate: 1,
  selected: 2,
  excluded: 3,
};

const hardStatusOrder: Record<CandidateScore["hardStatus"], number> = {
  pass: 0,
  notice: 1,
  unknown: 2,
  conflict: 3,
};

export class GetCandidateFunnel {
  constructor(
    private readonly generations: GenerationRepository,
    private readonly assessments: AssessmentRepository,
    private readonly evaluations: EvaluationRepository,
    private readonly projects: ProjectRepository,
  ) {}

  async execute(projectId: string, pools?: CandidatePool[]): Promise<CandidateFunnelItem[]> {
    const workspace = await this.projects.getWorkspace(projectId);
    if (!workspace) return [];

    const [records, evaluations, scores] = await Promise.all([
      this.generations.listCandidates(projectId, pools),
      this.evaluations.list(projectId),
      this.assessments.listScores({
        projectId,
        configRevision: workspace.profile.configRevision,
      }),
    ]);
    const evaluationsByCandidate = new Map(
      evaluations.map((evaluation) => [evaluation.candidateId, evaluation]),
    );
    const scoresByCandidate = new Map(scores.map((score) => [score.candidateId, score]));

    return records
      .map(({ candidate, decision, sources }): CandidateFunnelItem => {
        const evaluation = evaluationsByCandidate.get(candidate.id);
        const score = scoresByCandidate.get(candidate.id);
        return {
          id: candidate.id,
          ...(candidate.batchId ? { batchId: candidate.batchId } : {}),
          createdAt: candidate.createdAt,
          givenName: candidate.givenName,
          fullName: candidate.fullName,
          pinyin: candidate.pinyin,
          sourceType: candidate.sourceType,
          summary: candidate.summary,
          sourceEvidence: sources,
          pool: decision.pool,
          ...(decision.pool === "excluded"
            ? {
                lastActivePool: decision.lastActivePool,
                exclusionReason: decision.exclusionReason,
                excludedAt: decision.excludedAt,
              }
            : {}),
          decisionUpdatedAt: decision.updatedAt,
          scoringPending: !score,
          hardStatus: score?.hardStatus ?? "unknown",
          ...(score?.totalScore !== undefined ? { totalScore: score.totalScore } : {}),
          completeness: score?.completeness ?? 0,
          moduleScores: score?.moduleScores ?? {},
          topDeductions: score?.topDeductions ?? [],
          hiddenScoredModuleCount: score?.hiddenScoredModuleCount ?? 0,
          ...(evaluation?.rating !== undefined ? { rating: evaluation.rating } : {}),
          ...(evaluation?.note !== undefined ? { note: evaluation.note } : {}),
        };
      })
      .sort(compareCandidates);
  }
}

function compareCandidates(left: CandidateFunnelItem, right: CandidateFunnelItem): number {
  return (
    poolOrder[left.pool] - poolOrder[right.pool] ||
    hardStatusOrder[left.hardStatus] - hardStatusOrder[right.hardStatus] ||
    (right.totalScore ?? -1) - (left.totalScore ?? -1) ||
    right.completeness - left.completeness ||
    (right.rating ?? 0) - (left.rating ?? 0) ||
    (left.createdAt ?? "").localeCompare(right.createdAt ?? "") ||
    left.id.localeCompare(right.id)
  );
}
