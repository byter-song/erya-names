import type { CandidateDetail } from "../models/CandidateDetail";
import type { AssessmentRepository } from "../ports/AssessmentRepository";
import type { ProjectRepository } from "../ports/ProjectRepository";
import { GetCandidateFunnel } from "./GetCandidateFunnel";

export class GetCandidateDetail {
  constructor(
    private readonly funnel: GetCandidateFunnel,
    private readonly assessments: AssessmentRepository,
    private readonly projects: ProjectRepository,
  ) {}

  async execute(projectId: string, candidateId: string): Promise<CandidateDetail | undefined> {
    const [workspace, candidates] = await Promise.all([
      this.projects.getWorkspace(projectId),
      this.funnel.execute(projectId),
    ]);
    const candidate = candidates.find(({ id }) => id === candidateId);
    if (!workspace || !candidate) return undefined;

    const score = await this.assessments.getScore({
      projectId,
      candidateId,
      configRevision: workspace.profile.configRevision,
    });
    if (!score) return { candidate, evidence: [], hiddenEvidenceCount: 0 };

    const allEvidence = await this.assessments.listEvidence({
      projectId,
      candidateId,
      inputHash: score.inputHash,
    });
    const evidence = allEvidence.filter(
      ({ moduleId }) =>
        moduleId === "basic" || workspace.profile.modules[moduleId].detailsVisible,
    );
    return {
      candidate,
      evidence,
      hiddenEvidenceCount: allEvidence.length - evidence.length,
    };
  }
}
