import type {
  ManualCandidateInput,
  ManualCandidateRepository,
} from "../../application/ports/ManualCandidateRepository";
import type { EryaDatabase } from "../database/EryaDatabase";

export class DexieManualCandidateRepository implements ManualCandidateRepository {
  constructor(private readonly database: EryaDatabase) {}

  async exists(projectId: string, normalizedFingerprint: string): Promise<boolean> {
    return (
      (await this.database.candidates
        .where("[projectId+normalizedFingerprint]")
        .equals([projectId, normalizedFingerprint])
        .count()) > 0
    );
  }

  async save({ candidate, source }: ManualCandidateInput): Promise<void> {
    if (
      candidate.projectId !== source.projectId ||
      candidate.id !== source.candidateId ||
      candidate.sourceType !== "user_input"
    )
      throw new Error("manual-candidate-input-mismatch");

    await this.database.transaction(
      "rw",
      [
        this.database.projects,
        this.database.candidates,
        this.database.candidateSources,
        this.database.candidateDecisions,
      ],
      async () => {
        if (!(await this.database.projects.get(candidate.projectId)))
          throw new Error("project-not-found");
        await this.database.candidates.add(candidate);
        await this.database.candidateSources.add(source);
        await this.database.candidateDecisions.add({
          candidateId: candidate.id,
          projectId: candidate.projectId,
          pool: "inspiration",
          updatedAt: candidate.createdAt,
        });
      },
    );
  }
}
