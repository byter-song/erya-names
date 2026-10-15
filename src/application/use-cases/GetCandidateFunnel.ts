import { currentEligibility } from "../../domain/rules/currentEligibility";
import type { ProjectRepository } from "../ports/ProjectRepository";
import type { GenerationRepository } from "../ports/GenerationRepository";
import type { EvaluationRepository } from "../ports/EvaluationRepository";
import type { CandidateFunnelItem } from "../models/CandidateFunnelItem";
import {
  normalizeCandidateStage,
  type CandidateDecision,
} from "../../domain/candidate/decision";

export class GetCandidateFunnel {
  constructor(
    private readonly repository: GenerationRepository,
    private readonly evaluations?: EvaluationRepository,
    private readonly projects?: ProjectRepository,
  ) {}

  async execute(
    projectId: string,
    stages?: CandidateDecision["stage"][],
  ): Promise<CandidateFunnelItem[]> {
    const workspace = await this.projects?.getWorkspace(projectId);
    const [records, evaluations] = await Promise.all([
      this.repository.listCandidates(projectId, stages),
      this.evaluations?.list(projectId) ?? Promise.resolve([]),
    ]);
    const evaluationsByCandidate = new Map(
      evaluations.map((evaluation) => [evaluation.candidateId, evaluation]),
    );
    return records.map(
      ({ candidate, decision, warnings, systemScore, scoreEvidence, ruleEvidence }) => {
        const evaluation = evaluationsByCandidate.get(candidate.id);
        const issue = workspace ? currentEligibility(candidate, workspace.profile) : undefined;
        return {
          ...(issue ? { eligibilityIssue: issue } : {}),
          id: candidate.id,
          ...(candidate.batchId ? { batchId: candidate.batchId } : {}),
          createdAt: candidate.createdAt,
          givenName: candidate.givenName,
          fullName: candidate.fullName,
          pinyin: candidate.pinyin,
          sourceType: candidate.sourceType,
          summary: candidate.summary,
          styleTags: candidate.styleTags,
          characterEvidence: candidate.characterEvidence ?? [],
          sourceEvidence: candidate.sourceEvidence,
          usageNotes: candidate.sourceEvidence
            .filter((source) => source.sourceId === "erya-modern-20260927")
            .flatMap((source) => (source.excerpt ? [source.excerpt] : [])),
          stage: normalizeCandidateStage(decision.stage),
          ...(decision.lastActiveStage ? { lastActiveStage: decision.lastActiveStage } : {}),
          decisionUpdatedAt: decision.updatedAt,
          ...(decision.folkloreReviewed ? { folkloreReviewed: true } : {}),
          ...(decision.rejectionReason ? { rejectionReason: decision.rejectionReason } : {}),
          warnings,
          systemScore,
          scoreEvidence: scoreEvidence.map((item) => ({
            ruleId: item.ruleId,
            outcome: item.outcome,
            explanation: item.explanation,
            scoreDelta: item.scoreDelta ?? 0,
          })),
          ruleEvidence,
          ...(evaluation?.rating !== undefined ? { rating: evaluation.rating } : {}),
          ...(evaluation?.note !== undefined ? { note: evaluation.note } : {}),
        };
      },
    );
  }
}
